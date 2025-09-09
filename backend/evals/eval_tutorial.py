from unittest.mock import MagicMock
from uuid import UUID

from autoevals import LLMClassifier
from braintrust import Eval
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from sqlalchemy.orm import Session

from onyx.chat.answer import Answer
from onyx.chat.models import AnswerStyleConfig
from onyx.chat.models import CitationConfig
from onyx.chat.models import PromptConfig
from onyx.chat.prompt_builder.answer_prompt_builder import AnswerPromptBuilder
from onyx.chat.prompt_builder.answer_prompt_builder import default_build_system_message
from onyx.chat.prompt_builder.answer_prompt_builder import default_build_user_message
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.llm.braintrust_setup import setup_braintrust_tracing
from onyx.llm.factory import get_llm
from onyx.tools.force import ForceUseTool
from onyx.tools.tool import Tool

quality = LLMClassifier(
    name="Quality",
    prompt_template="""You are an expert at judging how humans would rate and compare six candidate answers for a given research question.
For background, the user selected a setting that allowed the system to think/research for a while and then compose an answer.

# YOUR TASK
You are presented a candidate answer and you should rate:

a) Whether the answer in principle fully answers the question. Rate the candidate answer on a scale from A to F.
 F: poor answer - not at all well-answered or big components missing
 D: mediocre answer - gaps in reasoning or some smallern points not addressed, or not a clear presentation
 C: solid answer - but not particularly thoughtful or informative beyind the basics
 B: good answer - solidly researched and composed. Maybe a bit too concise or a bit chatty
 A: excellent answer - very thorough, informative, and well-presented. As good or better than state of the art answer.\n\n

The state of the art answer is: \n {{expected}} \n \n
The candidate answer is: \n{{output}}""",
    choice_scores={"F": 0, "D": 0.25, "C": 0.5, "B": 0.75, "A": 1},
    use_cot=True,
)

setup_braintrust_tracing()


# Create a mock database session that passes type checking
def create_mock_db_session():
    """Create a mock database session for evaluation purposes"""
    mock_session = MagicMock(spec=Session)
    mock_session.commit.return_value = None
    mock_session.add.return_value = None
    mock_session.execute.return_value = MagicMock()
    mock_session.scalars.return_value = MagicMock()
    mock_session.query.return_value = MagicMock()
    return mock_session


# Initialize real LLMs for evaluation
def get_evaluation_llms():
    """Get real LLMs for evaluation purposes using OpenAI GPT-4.1"""
    try:
        # Create OpenAI GPT-4.1 LLM directly
        llm = get_llm(
            provider="openai",
            model="gpt-4.1",
            max_input_tokens=128000,  # GPT-4.1 context window
            deployment_name=None,
            api_key=None,  # Will use environment variable OPENAI_API_KEY
            api_base=None,
            api_version=None,
            custom_config=None,
            temperature=0.7,
            timeout=None,
            additional_headers=None,
            long_term_logger=None,
        )

        # Use the same LLM for both primary and fast LLM
        fast_llm = llm

        print("Successfully created OpenAI GPT-4.1 LLM for evaluation")
        return llm, fast_llm
    except Exception as e:
        print(f"Warning: Could not create OpenAI GPT-4.1 LLM: {e}")
        print("Falling back to mock LLMs for evaluation")
        raise e
        # Fallback to mock if real LLMs are not available


# Mock objects for evaluation
prompt_config = PromptConfig(
    system_prompt="You are a helpful AI assistant. Answer questions clearly and concisely.",
    task_prompt="Please provide a helpful response to the user's question.",
    datetime_aware=True,
)

answer_style_config = AnswerStyleConfig(
    citation_config=CitationConfig(all_docs_useful=False),
    structured_response_format=None,
)

# Initialize real LLMs for evaluation
llm, fast_llm = get_evaluation_llms()

# Additional mock objects needed for the evaluation
persona = None  # No persona for this evaluation
new_msg_req = type("MockRequest", (), {"llm_override": None})()
chat_session = type("MockChatSession", (), {"llm_override": None})()
litellm_additional_headers = None


def get_answer(input: str) -> str:
    load_dotenv()
    # TODO: Hardcode tools used
    tools: list[Tool] = []

    # Try to get a real database session, fall back to mock if not available
    try:
        with get_session_with_current_tenant() as db_session:
            return _get_answer_with_session(input, tools, db_session)
    except Exception as e:
        print(f"Warning: Could not get real database session: {e}")
        print("Using mock database session for evaluation")
        mock_db_session = create_mock_db_session()
        return _get_answer_with_session(input, tools, mock_db_session)


def _get_answer_with_session(input: str, tools: list[Tool], db_session: Session) -> str:
    prompt_builder = AnswerPromptBuilder(
        user_message=default_build_user_message(
            user_query=HumanMessage(content=input),
            prompt_config=prompt_config,
            files=[],
            single_message_history=None,
        ),
        system_message=default_build_system_message(prompt_config, llm.config),
        message_history=[],
        llm_config=llm.config,
        raw_user_query=input,
        raw_user_uploaded_files=[],
        single_message_history=None,
    )

    # LLM prompt building, response capturing, etc.
    answer = Answer(
        prompt_builder=prompt_builder,
        is_connected=lambda: True,
        latest_query_files=[],
        answer_style_config=answer_style_config,
        llm=llm,
        fast_llm=fast_llm,
        force_use_tool=ForceUseTool(force_use=False, tool_name="", args=None),
        persona=persona,
        rerank_settings=None,
        chat_session_id=UUID("123e4567-e89b-12d3-a456-426614174000"),
        current_agent_message_id=0,
        tools=tools,
        db_session=db_session,
        use_agentic_search=False,
        skip_gen_ai_answer_generation=False,
    )

    # Extract text content from packets
    text_parts = []
    for packet in answer.processed_streamed_output:
        if hasattr(packet.obj, "content"):
            text_parts.append(packet.obj.content)

    return "".join(text_parts)


Eval(
    "Say Hi Bot",  # Replace with your project name
    data=[
        {
            "input": "compare the EV strategy of Chevrolet and Tesla",
            "expected": """
Here’s the short, forward-looking take on how Chevrolet and Tesla are playing the EV game—and what it sets up for the next 5 years.

Strategy in one line

Chevrolet: “Make EVs normal-priced and widespread.” Ultium platform across crossovers and trucks, heavy push on affordability (Equinox EV now, Bolt reboot next), plus a pragmatic shift to NACS charging and lower-cost LFP cells later in the decade. 
Chevrolet
GM News
+1
Reuters
MotorTrend

Tesla: “Keep scale, monetize software, and stretch into autonomy/AI.” Core volume stays 3/Y (with refreshes), Supercharger as a moat even amid turbulence, FSD as recurring revenue; 2025’s “Master Plan Part IV” signals an even bigger bet on autonomy and robots. 
Tesla Investor Relations
Tesla
+2
Tesla
+2
Axios

Product & pricing lanes (2025→2027)

Chevrolet

Equinox EV enters the true mass market (from ~$33.6k MSRP; 319-mile FWD EPA est.). This is Chevy’s price anchor. 
Chevrolet

Blazer EV recovered from a 2023 stop-sale with software fixes and price cuts, re-establishing the mid-market step-up. 
AP News
Car and Driver

Silverado EV broadens trims and range up to ~492 miles (EPA est.), finally giving GM a serious electric truck ladder. 
GM News
The Verge

Bolt’s return: production slated to begin late 2025 (first deliveries early 2026) on Ultium, with an affordability focus—Chevy’s volume play for the next wave. 
TopElectricSUV
Car and Driver

Tesla

3/Y remain the volume engine, with 2025 refresh activity (e.g., Model Y “Juniper” variants) to keep demand warm. Q2’25 deliveries: ~384k. 
Tesla Investor Relations
TopElectricSUV
TechRadar

Supercharger moat continues to matter as others adopt NACS, even after the 2024 layoffs/re-hires drama. 
Tesla
Bloomberg.com

Roadmap messaging skews to autonomy/AI and robots (Master Plan IV), which may lift software value but leaves EV product specifics thinner than past plans. 
Tesla
The Verge
The Motley Fool

Charging & standardization

NACS migration: GM/Chevrolet joined the Tesla plug parade—adapters in 2024/2025 and native ports rolling in on new models (including the next Bolt), aligning Chevy buyers with the largest fast-charge network. 
MotorTrend
GM News
Electrek

Supercharger network: despite staffing whiplash in 2024, access keeps opening to more brands in 2025, reinforcing Tesla’s network effect. 
Bloomberg.com
Car and Driver
Tesla

Batteries & cost curve

Chevrolet (Ultium): near-term packs are largely NCMA on Ultium; GM is converting Spring Hill for LFP to cut costs—commercial output expected by late 2027. If that lands, it underwrites Bolt-class pricing at scale. 
Reuters
ultiumcell.com

Tesla (4680 & mfg): continues vertical-integration bets (cells, cathode, lithium refining) and giga-casting/assembly innovations; official comms point to key production assets coming online in 2025. Software/energy layers are growing, too (9.6 GWh storage deployed in Q2’25). 
Tesla
Tesla Investor Relations

Software & autonomy economics

Chevrolet: conventional ADAS stack; the software story is secondary to hitting mainstream price points and quality/reliability targets (the Blazer EV lesson). 
AP News

Tesla: FSD (Supervised) is now a $99/mo subscription, anchoring a recurring-revenue thesis while autonomy remains supervised. 
Tesla

5-year outlook (working theory, not prophecy)

Chevy’s upside: If Equinox EV + next-gen Bolt + LFP hit on time, Chevy becomes the “default affordable EV” for U.S. households—especially with NACS access. Risk: GM’s mixed signals on an all-EV timeline and prior software hiccups; battery LFP shift doesn’t materially help until 2027. 
Politico
AP News
Reuters

Tesla’s upside: Scale + margins from manufacturing, plus software revenue from FSD; network and brand still strong. Risk: product cadence feels thinner as attention pivots to robots/robotaxi; Supercharger expansion velocity post-layoffs; rising competition and delivery softness vs. global leaders. 
Tesla
Bloomberg.com
Electrek

Side-by-side snapshot
Dimension	Chevrolet	Tesla
Core bet	Mass-market pricing + Ultium scale	Scale + software (FSD) + autonomy/AI
Volume pillars (2025–27)	Equinox EV now; Silverado EV trims; Bolt returns 2026	Model 3/Y (refreshes); selective variants; Cybertruck niche
Entry MSRP signal	Equinox EV from ~$33.6k	Model 3/Y typically higher street price in U.S. (varies with incentives)
Charging	NACS adapters now; native NACS phasing in (incl. next Bolt)	Operates Supercharger; opening to others; still the pace-setter
Battery roadmap	Ultium today; LFP at Spring Hill by ~late 2027	4680 ramp + in-house cathode/lithium; manufacturing integration
Recent wobbles	Blazer EV software stop-sale (resolved with updates & price cuts)	Supercharger team layoffs/re-hires; delivery pressure vs. rivals
5-yr swing factor	Deliver LFP + dealer discipline → win “affordable EV” crown	Convert FSD into durable, regulator-blessed autonomy economics

Chevrolet
GM News
+1
TopElectricSUV
Tesla
+1
AP News
Car and Driver
Bloomberg.com
Tesla Investor Relations

Want to stress-test this from a buyer’s lens next—e.g., total cost of ownership at 12k vs 18k miles/year or road-trip charging time on a West-coast corridor? That’s where these strategies get real.""",
        },
        {
            "input": "What are the regulations around meeting booths in San Francisco?",
            "expected": """
            If you're looking to install meeting booths—also known as privacy pods or phone booths—in San Francisco (e.g., in offices, coworking spaces, or other commercial interiors), here's what you need to know:

1. Building Permits & Plan Review Requirements

A building permit is required for installing any booth or pod under the California Building Code (CBC). This applies to all commercial tenant improvements or alterations.
SF Media API

You must submit detailed plans for review, including:

Title page with site plan & building details

Floor plan showing booth location

Egress plan for paths to exits

Disabled access (DA) checklist and details per CBC Chapter 11B

Elevations, sections, installation details

Manufacturer’s cut sheets for pre-manufactured pods

Structural floor information and anchoring details
SF Media API

These plans must be stamped and signed by a licensed architect or engineer.
SF Media API

2. Seismic Anchor & Structural Safety

San Francisco’s seismic risk mandates that all booths must be anchored and secured to prevent movement—complying with ASCE7-16 requirements for non-structural components, and according to manufacturer specs.
SF Media API
SF Fire

3. Accessibility (ADA/CBC Chapter 11B)

Booths must comply with accessibility regulations:

If only one booth (single- or multi-user) is installed, it must be fully accessible.

If multiple single-user booths, at least one—or 5%—must be fully accessible.

All multi-user booths must be fully accessible.

In some cases, an existing accessible room nearby may serve as an equivalent.
SF Media API

4. Fire Safety: Sprinklers & Alarms

The San Francisco Fire Department (SFFD) requires:

Sprinklers inside booths that exceed 4 feet in any dimension, connected to the building's sprinkler system.

Booths under 4 feet per direction may be exempt if:

Made of non-combustible materials,

Positioned at least 4 feet away from other booths or obstructions,

Manufacturer's cut sheets verifying compliance are submitted with plans.
SF Media API

A separate fire permit is required if new sprinkler work is involved.
SF Media API

5. Fire Alarm & Visual/Audible Signaling

Some booths might be required to integrate visual (strobes) and audible alarms connected to the building’s fire alarm system. This is often required for “private rooms/spaces” used as booths or focused/quiet rooms. Verify specific requirements with the SFFD plan review team.
SF Media API

6. Electrical Requirements

If the booth requires hard-wired electrical or data connections, an electrical trade permit is needed.

However, booths may simply plug into existing approved outlets.

Extension cords are not allowed.
SF Media API

7. Putting It All Together

Over-the-counter (OTC) permits can often be issued quickly if the submitted plans meet requirements and can be reviewed in under an hour per station.
SF Media API

The overall process is typically routed through both DBI (Department of Building Inspection) and SFFD, combining building and fire plan review. Expect a short processing timeline (often within a couple of days) if everything is in order.
San Francisco Standard
SF Media API

Summary Table
Requirement	Details
Building Permit	Required for booth installation and tenant improvements
Architect/Engineer Plans	Multiple detailed drawings, DA checklist, manufacturer specs
Seismic Anchoring	Required per ASCE7-16 and manufacturer guidance
Accessibility (ADA)	1 booth or 5% must be accessible; all multi-user booths must be
Sprinklers (Fire Safety)	Required in booths over 4′ in any direction, or exempt if small and non-combustible
Alarm Systems	Visual/audible alarms may be required—verify with SFFD
Electrical	Permits needed for hard-wired connections; extension cords prohibited
Permits Timeline	OTC process available; often reviewed quickly by DBI and SFFD
Why These Rules Matter

Several San Francisco businesses have discovered that prefab phone booths often require more than “plug-and-play” installation—due to seismic safety, fire codes, and accessibility rules. Many booths lack built-in sprinklers or alarms, so the responsibility falls on building operators to ensure they comply—or face permitting challenges.
San Francisco Standard

Steps to Proceed Smoothly

Engage with DBI early to understand plan requirements and the OTC permitting process.

Hire a licensed architect or engineer to produce compliant drawings and details.

Confirm accessibility measures with Chapter 11B CBC.

Coordinate with SFFD to address sprinklers, alarms, and possible fire-permit needs.

Factor in electrical permitting if fixtures need new wiring.

Apply and submit plans; anticipate a streamlined review if everything is complete.

Need help drafting plans, finding a compliant booth vendor, or contacting city departments? Happy to walk you through the next steps—or share helpful resources.
            """,
        },
    ],  # Replace with your eval dataset
    task=get_answer,  # Replace with your LLM call
    scores=[quality],
)
