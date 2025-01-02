from pydantic import BaseModel


### Models ###


class Entity(BaseModel):
    entity_name: str
    entity_type: str


class Relationship(BaseModel):
    relationship_name: str
    relationship_type: str
    relationship_entities: list[str]


class Term(BaseModel):
    term_name: str
    term_type: str
    term_similar_to: list[str]


class EntityRelationshipTermExtraction(BaseModel):
    entities: list[Entity]
    relationships: list[Relationship]
    terms: list[Term]
