import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.revision_service import RevisionService
from app.models.generation_job import JobStatus


@pytest.fixture
def svc():
    return RevisionService()


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


async def test_save_revision_creates_record(svc, mock_db):
    scene_id = uuid.uuid4()
    rev = await svc.save_revision(
        mock_db,
        content="Egyszer volt, hol nem volt.",
        revision_type="rewrite",
        scene_id=scene_id,
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()
    assert rev.content == "Egyszer volt, hol nem volt."
    assert rev.approved is False
    assert rev.revision_type == "rewrite"
    assert rev.scene_id == scene_id


async def test_create_job_status_is_running(svc, mock_db):
    job = await svc.create_job(
        mock_db,
        job_type="rewrite",
        scene_id=uuid.uuid4(),
    )
    assert job.status == JobStatus.RUNNING
    assert job.job_type == "rewrite"


async def test_complete_job_sets_done(svc, mock_db):
    from app.models.generation_job import GenerationJob
    job = GenerationJob(job_type="rewrite", status=JobStatus.RUNNING)
    result = await svc.complete_job(mock_db, job, output_data={"revision_id": "abc"})
    assert result.status == JobStatus.DONE
    assert result.output_data == {"revision_id": "abc"}


async def test_fail_job_sets_failed(svc, mock_db):
    from app.models.generation_job import GenerationJob
    job = GenerationJob(job_type="rewrite", status=JobStatus.RUNNING)
    result = await svc.fail_job(mock_db, job, error_message="LLM timed out")
    assert result.status == JobStatus.FAILED
    assert result.error_message == "LLM timed out"


async def test_singleton_exists():
    from app.services.revision_service import revision_service
    assert isinstance(revision_service, RevisionService)
