"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AssistantCard from "./AgentCard";
import { useUser } from "@/components/user/UserProvider";
import { FilterIcon } from "lucide-react";
import { checkUserOwnsAssistant as checkUserOwnsAgent } from "@/lib/assistants/checkOwnership";
import { useAgentsContext } from "@/components-2/context/AgentsContext";
import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import Text from "@/components-2/Text";
import Modal from "@/components-2/Modal";
import { ModalIds, useModal } from "@/components-2/context/ModalContext";

interface AgentsSectionProps {
  title: string;
  agents: MinimalPersonaSnapshot[];
  pinnedAgents: MinimalPersonaSnapshot[];
}

function AgentsSection({ title, agents, pinnedAgents }: AgentsSectionProps) {
  const { toggleModal } = useModal();

  if (agents.length === 0) {
    return null;
  }

  return (
    <div className="p-padding-content flex flex-col gap-spacing-paragraph">
      <Text subheading>{title}</Text>

      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-spacing-paragraph">
        {agents
          .sort((a, b) => b.id - a.id)
          .map((agent, index) => (
            <AssistantCard
              key={index}
              pinned={pinnedAgents.map((a) => a.id).includes(agent.id)}
              agent={agent}
              closeModal={() => toggleModal(ModalIds.AgentsModal, false)}
            />
          ))}
      </div>
    </div>
  );
}

interface AgentBadgeSelectorProps {
  text: string;
  selected: boolean;
  toggleFilter: () => void;
}

function AgentBadgeSelector({
  text,
  selected,
  toggleFilter,
}: AgentBadgeSelectorProps) {
  return (
    <div
      className={`
        select-none ${
          selected
            ? "bg-background-900 text-white"
            : "bg-transparent text-text-900"
        } w-12 h-5 text-center px-1 py-0.5 rounded-lg cursor-pointer text-[12px] font-normal leading-[10px] border border-black justify-center items-center gap-1 inline-flex`}
      onClick={toggleFilter}
    >
      {text}
    </div>
  );
}

export enum AgentFilter {
  Pinned = "Pinned",
  Public = "Public",
  Private = "Private",
  Mine = "Mine",
}

function useAgentFilters() {
  const [agentFilters, setAgentFilters] = useState<
    Record<AgentFilter, boolean>
  >({
    [AgentFilter.Pinned]: false,
    [AgentFilter.Public]: false,
    [AgentFilter.Private]: false,
    [AgentFilter.Mine]: false,
  });

  function toggleAgentFilter(filter: AgentFilter) {
    setAgentFilters((prevFilters) => ({
      ...prevFilters,
      [filter]: !prevFilters[filter],
    }));
  }

  return { agentFilters, toggleAgentFilter };
}

export default function AgentsModal() {
  const { agents, pinnedAgents } = useAgentsContext();
  const { agentFilters, toggleAgentFilter } = useAgentFilters();
  const router = useRouter();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const memoizedCurrentlyVisibleAgents = useMemo(() => {
    return agents.filter((agent) => {
      const nameMatches = agent.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const labelMatches = agent.labels?.some((label) =>
        label.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      const publicFilter = !agentFilters[AgentFilter.Public] || agent.is_public;
      const privateFilter =
        !agentFilters[AgentFilter.Private] || !agent.is_public;
      const pinnedFilter =
        !agentFilters[AgentFilter.Pinned] ||
        (pinnedAgents.map((a) => a.id).includes(agent.id) ?? false);

      const mineFilter =
        !agentFilters[AgentFilter.Mine] || checkUserOwnsAgent(user, agent);

      const isNotUnifiedAgent = agent.id !== 0;

      return (
        (nameMatches || labelMatches) &&
        publicFilter &&
        privateFilter &&
        pinnedFilter &&
        mineFilter &&
        isNotUnifiedAgent
      );
    });
  }, [agents, searchQuery, agentFilters]);

  const featuredAgents = [
    ...memoizedCurrentlyVisibleAgents.filter(
      (agent) => agent.is_default_persona
    ),
  ];
  const allAgents = memoizedCurrentlyVisibleAgents.filter(
    (agent) => !agent.is_default_persona
  );

  return (
    <Modal id={ModalIds.AgentsModal} title="Agents">
      <div className="flex flex-col sticky top-0 z-10">
        <div className="flex px-2 justify-between items-center gap-x-2 mb-0">
          <div className="h-12 w-full rounded-lg flex-col justify-center items-start gap-2.5 inline-flex">
            <div className="h-12 rounded-md w-full shadow-[0px_0px_2px_0px_rgba(0,0,0,0.25)] border border-background-300 flex items-center px-3">
              {!isSearchFocused && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-text-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              )}
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                type="text"
                className="w-full h-full bg-transparent outline-none text-black"
              />
            </div>
          </div>
          <button
            onClick={() => router.push("/assistants/new")}
            className="h-10 cursor-pointer px-6 py-3 bg-background-800 hover:bg-black rounded-md border border-black justify-center items-center gap-2.5 inline-flex"
          >
            <div className="text-text-50 text-lg font-normal leading-normal">
              Create
            </div>
          </button>
        </div>
        <div className="px-2 flex py-4 items-center gap-x-2 flex-wrap">
          <FilterIcon className="text-text-800" size={16} />
          <AgentBadgeSelector
            text="Pinned"
            selected={agentFilters[AgentFilter.Pinned]}
            toggleFilter={() => toggleAgentFilter(AgentFilter.Pinned)}
          />

          <AgentBadgeSelector
            text="Mine"
            selected={agentFilters[AgentFilter.Mine]}
            toggleFilter={() => toggleAgentFilter(AgentFilter.Mine)}
          />
          <AgentBadgeSelector
            text="Private"
            selected={agentFilters[AgentFilter.Private]}
            toggleFilter={() => toggleAgentFilter(AgentFilter.Private)}
          />
          <AgentBadgeSelector
            text="Public"
            selected={agentFilters[AgentFilter.Public]}
            toggleFilter={() => toggleAgentFilter(AgentFilter.Public)}
          />
        </div>
        <div className="w-full border-t border-background-200" />
      </div>

      <div className="h-full w-full">
        {featuredAgents.length === 0 && allAgents.length === 0 ? (
          <Text
            callout
            className="w-full h-full flex flex-col items-center justify-center"
          >
            No Agents configured yet...
          </Text>
        ) : (
          <>
            <AgentsSection
              title="Featured Agents"
              agents={featuredAgents}
              pinnedAgents={pinnedAgents}
            />
            <AgentsSection
              title="All Agents"
              agents={allAgents}
              pinnedAgents={pinnedAgents}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
