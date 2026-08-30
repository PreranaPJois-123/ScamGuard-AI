import email
import io
import os
import httpx
from fastapi import UploadFile

from app_service.core.config import get_settings

settings = get_settings()

class ExtractionService:
    @staticmethod
    def extract(file: UploadFile | None, text: str | None, input_type: str) -> tuple[str, dict]:
        input_type = input_type.upper()
        
        if input_type == "URL":
            if not text:
                raise ValueError("URL text must be provided for URL input_type.")
            try:
                try:
                    from bs4 import BeautifulSoup
                except ImportError:
                    raise ValueError("Package 'beautifulsoup4' is required for URL extraction.")
                response = httpx.get(text, timeout=10.0)
                response.raise_for_status()
                soup = BeautifulSoup(response.text, 'html.parser')
                extracted_text = soup.get_text(separator=' ', strip=True)
                title = soup.title.string if soup.title else ""
                return extracted_text, {"url": text, "title": title.strip()}
            except Exception as e:
                raise ValueError(f"Failed to extract URL: {str(e)}")
                
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
                            body += part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='ignore')
                        elif part.get_content_type() == "text/html" and not body:
                            html = part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='ignore')
                            try:
                                from bs4 import BeautifulSoup
                                soup = BeautifulSoup(html, 'html.parser')
                                body = soup.get_text(separator=' ', strip=True)
                            except ImportError:
                                body = html
                else:
                    body = msg.get_payload(decode=True).decode(msg.get_content_charset() or 'utf-8', errors='ignore')
                
                extracted_text = f"Subject: {subject}\n\n{body}"
                return extracted_text.strip(), {"subject": subject, "from": sender}
            except Exception as e:
                raise ValueError(f"Failed to extract EMAIL: {str(e)}")
                
        elif input_type == "QR":
            if not file:
                raise ValueError("File must be provided for QR input_type.")
            try:
                try:
                    from PIL import Image
                    from pyzbar.pyzbar import decode
                except ImportError:
                    raise ValueError("Packages 'Pillow' and 'pyzbar' are required for QR extraction.")
                img = Image.open(io.BytesIO(file.file.read()))
                decoded_objects = decode(img)
                if not decoded_objects:
                    raise ValueError("No QR code found in the image.")
                
                obj = decoded_objects[0]
                data = obj.data.decode('utf-8')
                return data, {"qr_type": obj.type}
            except Exception as e:
                raise ValueError(f"Failed to extract QR: {str(e)}")
                
        elif input_type == "IMAGE":
            if not file:
                raise ValueError("File must be provided for IMAGE input_type.")
            try:
                try:
                    from PIL import Image
                    import pytesseract
                except ImportError:
                    raise ValueError("Packages 'Pillow' and 'pytesseract' are required for IMAGE OCR extraction.")
                if settings.TESSERACT_CMD:
                    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
                img = Image.open(io.BytesIO(file.file.read()))
                extracted_text = pytesseract.image_to_string(img)
                return extracted_text.strip(), {"ocr_detected": True}
            except Exception as e:
                raise ValueError(f"Failed to extract IMAGE: {str(e)}")
                
        elif input_type == "PDF":
            if not file:
                raise ValueError("File must be provided for PDF input_type.")
            try:
                try:
                    from pypdf import PdfReader
                except ImportError:
                    raise ValueError("Package 'pypdf' is required for PDF extraction.")
                reader = PdfReader(io.BytesIO(file.file.read()))
                extracted_text = ""
                for page in reader.pages:
                    extracted_text += page.extract_text() + "\n"
                return extracted_text.strip(), {"pages": len(reader.pages)}
            except Exception as e:
                raise ValueError(f"Failed to extract PDF: {str(e)}")
                
        elif input_type == "TEXT":
            return text or "", {}
            
        else:
            raise ValueError(f"Unsupported input_type: {input_type}")
