import email
import io
import os
import httpx
from fastapi import UploadFile

from app_service.core.config import get_settings

settings = get_settings()

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

MAX_EXTRACTED_LENGTH = 4000


class ExtractionService:
    @staticmethod
    def extract(file: UploadFile | None, text: str | None, input_type: str) -> tuple[str, dict]:
        input_type = input_type.upper()

        if input_type == "URL":
            if not text or not text.strip():
                raise ValueError("URL address must be provided for URL input_type.")
            
            raw_url = text.strip()
            # Normalize scheme if user entered without http/https
            target_url = raw_url
            if not target_url.startswith("http://") and not target_url.startswith("https://"):
                target_url = "https://" + target_url

            title = ""
            page_text = ""
            fetch_error = None

            try:
                # Use httpx with follow_redirects=True so 301/302/307 redirects are seamlessly followed
                with httpx.Client(
                    follow_redirects=True,
                    timeout=12.0,
                    headers={"User-Agent": DEFAULT_USER_AGENT},
                    verify=False,
                ) as client:
                    resp = client.get(target_url)
                    resp.raise_for_status()

                    try:
                        from bs4 import BeautifulSoup
                        soup = BeautifulSoup(resp.text, "html.parser")
                        title = soup.title.string.strip() if soup.title and soup.title.string else ""
                        page_text = soup.get_text(separator=" ", strip=True)
                    except Exception:
                        page_text = resp.text[:2000]
            except Exception as exc:
                # If network fetch fails (redirect loop, auth wall, bot block, DNS fail),
                # do NOT crash! Fall back to analyzing the URL itself as the target payload.
                fetch_error = str(exc)

            if page_text:
                extracted = f"URL: {target_url}\nTitle: {title}\nContent:\n{page_text}"
            else:
                extracted = f"URL Target: {target_url}"

            metadata = {
                "url": target_url,
                "title": title or "External Domain Target",
            }
            if fetch_error:
                metadata["fetch_status"] = "direct_url_analysis"

            return extracted[:MAX_EXTRACTED_LENGTH].strip(), metadata

        elif input_type == "EMAIL":
            try:
                if file:
                    content = file.file.read()
                    if isinstance(content, bytes):
                        msg = email.message_from_bytes(content)
                    else:
                        msg = email.message_from_string(content)
                elif text:
                    msg = email.message_from_string(text)
                else:
                    raise ValueError("File or text must be provided for EMAIL input_type.")

                subject = msg.get("Subject", "")
                sender = msg.get("From", "")

                body = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain":
                            body += part.get_payload(decode=True).decode(
                                part.get_content_charset() or "utf-8", errors="ignore"
                            )
                        elif part.get_content_type() == "text/html" and not body:
                            html = part.get_payload(decode=True).decode(
                                part.get_content_charset() or "utf-8", errors="ignore"
                            )
                            try:
                                from bs4 import BeautifulSoup
                                soup = BeautifulSoup(html, "html.parser")
                                body = soup.get_text(separator=" ", strip=True)
                            except Exception:
                                body = html
                else:
                    body = msg.get_payload(decode=True).decode(
                        msg.get_content_charset() or "utf-8", errors="ignore"
                    )

                extracted_text = f"Subject: {subject}\nSender: {sender}\n\n{body}"
                if not extracted_text.strip():
                    extracted_text = f"Email communication from {sender or 'unknown sender'} with subject {subject or 'No subject'}"

                return extracted_text[:MAX_EXTRACTED_LENGTH].strip(), {"subject": subject, "from": sender}
            except Exception as e:
                raise ValueError(f"Failed to process EMAIL: {str(e)}")

        elif input_type == "QR":
            if not file:
                raise ValueError("Image file must be provided for QR input_type.")
            try:
                from PIL import Image
                from pyzbar.pyzbar import decode

                img = Image.open(io.BytesIO(file.file.read()))
                decoded_objects = decode(img)
                if not decoded_objects:
                    raise ValueError("No QR code or barcode pattern found in the uploaded image.")

                obj = decoded_objects[0]
                data = obj.data.decode("utf-8", errors="ignore")
                return data[:MAX_EXTRACTED_LENGTH].strip(), {"qr_type": str(obj.type)}
            except Exception as e:
                raise ValueError(f"Failed to scan QR code: {str(e)}")

        elif input_type == "IMAGE":
            if not file:
                raise ValueError("Image file must be provided for IMAGE input_type.")
            try:
                from PIL import Image
                import pytesseract

                if getattr(settings, "TESSERACT_CMD", None):
                    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

                img = Image.open(io.BytesIO(file.file.read()))
                extracted_text = pytesseract.image_to_string(img)
                if not extracted_text or not extracted_text.strip():
                    extracted_text = f"Image Attachment: {file.filename or 'image.png'} (Visual content scanned, no OCR text detected)"

                return extracted_text[:MAX_EXTRACTED_LENGTH].strip(), {"ocr_detected": True}
            except Exception as e:
                raise ValueError(f"Failed to perform image OCR: {str(e)}")

        elif input_type == "PDF":
            if not file:
                raise ValueError("PDF document must be provided for PDF input_type.")
            try:
                from pypdf import PdfReader

                reader = PdfReader(io.BytesIO(file.file.read()))
                extracted_text = ""
                # Scan up to the first 25 pages
                pages_to_scan = reader.pages[:25]
                for page in pages_to_scan:
                    try:
                        p_text = page.extract_text()
                        if p_text:
                            extracted_text += p_text + "\n"
                    except Exception:
                        continue

                extracted_text = extracted_text.strip()
                if not extracted_text:
                    extracted_text = f"PDF Document: {file.filename or 'document.pdf'} (Scanned document without embedded text layer)"

                return extracted_text[:MAX_EXTRACTED_LENGTH].strip(), {"pages": len(reader.pages)}
            except Exception as e:
                raise ValueError(f"Failed to parse PDF document: {str(e)}")

        elif input_type == "TEXT":
            text = text or ""
            return text[:MAX_EXTRACTED_LENGTH].strip(), {}

        else:
            raise ValueError(f"Unsupported input channel: {input_type}")
