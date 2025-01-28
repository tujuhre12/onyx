from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from onyx.db.models import UserFile
from onyx.db.models import UserFolder


router = APIRouter()


class FolderResponse(BaseModel):
    id: int
    name: str

    @classmethod
    def from_model(cls, model: UserFolder) -> "FolderResponse":
        return cls(id=model.id, name=model.name)


class FileResponse(BaseModel):
    id: int
    name: str
    document_id: str
    folder_id: int | None = None

    @classmethod
    def from_model(cls, model: UserFile) -> "FileResponse":
        return cls(
            id=model.id,
            name=model.name,
            folder_id=model.folder_id,
            document_id=model.document_id,
        )


class FolderDetailResponse(FolderResponse):
    files: List[FileResponse]


class MessageResponse(BaseModel):
    message: str


class FileSystemResponse(BaseModel):
    folders: list[FolderResponse]
    files: list[FileResponse]
