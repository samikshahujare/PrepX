import io
import pytest
from pypdf import PdfWriter
from docx import Document


def create_sample_pdf_bytes(name: str = "Alice Johnson", email: str = "alice.j@example.com") -> io.BytesIO:
    """Create a minimal valid PDF in memory with resume content."""
    # Create simple PDF stream with text
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    pdf_buffer = io.BytesIO()
    writer.write(pdf_buffer)
    pdf_buffer.seek(0)
    return pdf_buffer


def create_sample_docx_bytes(name: str = "Bob Smith", email: str = "bob.smith@example.com") -> io.BytesIO:
    """Create a valid DOCX document in memory with resume text."""
    doc = Document()
    doc.add_heading(name, level=0)
    doc.add_paragraph(f"Email: {email} | Phone: +1 555-019-2834")
    doc.add_heading("Skills", level=1)
    doc.add_paragraph("Python, FastAPI, PostgreSQL, Machine Learning, Docker, Git")
    doc.add_heading("Education", level=1)
    doc.add_paragraph("Bachelor of Science in Computer Science - Tech University (2020-2024)")
    doc.add_heading("Projects", level=1)
    doc.add_paragraph("PrepX Interview Training System - Built scalable backend with Python and PostgreSQL")
    doc.add_heading("Experience", level=1)
    doc.add_paragraph("Software Engineering Intern at CloudTech (2023)")

    docx_buffer = io.BytesIO()
    doc.save(docx_buffer)
    docx_buffer.seek(0)
    return docx_buffer


def test_upload_docx_resume_success(client, auth_headers):
    docx_bytes = create_sample_docx_bytes()
    files = {
        "file": ("bob_resume.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    }
    response = client.post("/api/v1/resumes/upload", files=files, headers={"Authorization": auth_headers["Authorization"]})
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["original_filename"] == "bob_resume.docx"
    assert data["file_type"] == "docx"
    assert data["upload_status"] == "parsed"
    assert "Python" in data["profile"]["skills"]
    assert "FastAPI" in data["profile"]["skills"]
    assert data["profile"]["email"] == "bob.smith@example.com"


def test_upload_unsupported_file_type_fails(client, auth_headers):
    fake_exe = io.BytesIO(b"MZ executable binary data")
    files = {
        "file": ("malicious.exe", fake_exe, "application/x-msdownload")
    }
    response = client.post("/api/v1/resumes/upload", files=files, headers={"Authorization": auth_headers["Authorization"]})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"


def test_list_and_get_resume_by_id(client, auth_headers):
    docx_bytes = create_sample_docx_bytes()
    files = {
        "file": ("sample_cv.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    }
    upload_res = client.post("/api/v1/resumes/upload", files=files, headers={"Authorization": auth_headers["Authorization"]})
    assert upload_res.status_code == 201
    resume_id = upload_res.json()["data"]["id"]

    # List resumes
    list_res = client.get("/api/v1/resumes", headers={"Authorization": auth_headers["Authorization"]})
    assert list_res.status_code == 200
    resumes_list = list_res.json()["data"]
    assert len(resumes_list) >= 1
    assert any(r["id"] == resume_id for r in resumes_list)

    # Get single resume
    get_res = client.get(f"/api/v1/resumes/{resume_id}", headers={"Authorization": auth_headers["Authorization"]})
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == resume_id


def test_unauthorized_resume_access(client):
    response = client.get("/api/v1/resumes")
    assert response.status_code == 401
