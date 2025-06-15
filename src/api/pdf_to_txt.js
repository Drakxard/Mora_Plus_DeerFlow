
import os
import sys
import argparse
from pathlib import Path
import logging

# Try different PDF libraries
try:
    import PyPDF2
    PDF_LIBRARY = 'PyPDF2'
except ImportError:
    try:
        import pdfplumber
        PDF_LIBRARY = 'pdfplumber'
    except ImportError:
        try:
            from pdfminer.high_level import extract_text
            PDF_LIBRARY = 'pdfminer'
        except ImportError:
            print("❌ No PDF library found. Install one of:")
            print("   pip install PyPDF2")
            print("   pip install pdfplumber") 
            print("   pip install pdfminer.six")
            sys.exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def extract_text_pypdf2(pdf_path):
    """Extract text using PyPDF2"""
    text = ""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n\n"
    except Exception as e:
        logger.error(f"Error with PyPDF2: {e}")
        return None
    return text.strip()

def extract_text_pdfplumber(pdf_path):
    """Extract text using pdfplumber (better for complex layouts)"""
    text = ""
    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n\n"
    except Exception as e:
        logger.error(f"Error with pdfplumber: {e}")
        return None
    return text.strip()

def extract_text_pdfminer(pdf_path):
    """Extract text using pdfminer"""
    try:
        from pdfminer.high_level import extract_text
        text = extract_text(str(pdf_path))
        return text.strip()
    except Exception as e:
        logger.error(f"Error with pdfminer: {e}")
        return None

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF using available library"""
    logger.info(f"📖 Processing: {pdf_path.name} (using {PDF_LIBRARY})")
    
    if PDF_LIBRARY == 'PyPDF2':
        return extract_text_pypdf2(pdf_path)
    elif PDF_LIBRARY == 'pdfplumber':
        return extract_text_pdfplumber(pdf_path)
    elif PDF_LIBRARY == 'pdfminer':
        return extract_text_pdfminer(pdf_path)
    
    return None

def clean_text(text):
    """Clean extracted text"""
    if not text:
        return ""
    
    # Remove excessive whitespace
    import re
    text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)  # Max 2 consecutive newlines
    text = re.sub(r'[ \t]+', ' ', text)  # Multiple spaces to single space
    text = text.strip()
    
    return text

def convert_pdfs_to_txt(pdf_dir="pdfs", output_dir="content", clean=True):
    """Convert all PDFs in directory to TXT files"""
    pdf_path = Path(pdf_dir)
    output_path = Path(output_dir)
    
    //# Create directories if they don't exist
    pdf_path.mkdir(exist_ok=True)
    output_path.mkdir(exist_ok=True)
    
    # Find PDF files
    pdf_files = list(pdf_path.glob("*.pdf"))
    
    if not pdf_files:
        logger.warning(f"⚠️  No PDF files found in {pdf_dir}/")
        logger.info(f"💡 Add PDF files to {pdf_dir}/ directory")
        return
    
    logger.info(f"📚 Found {len(pdf_files)} PDF files to convert")
    
    converted = 0
    failed = 0
    
    for pdf_file in pdf_files:
        try:
            # Extract text
            text = extract_text_from_pdf(pdf_file)
            
            if not text or len(text.strip()) < 50:
                logger.warning(f"⚠️  {pdf_file.name}: No text extracted or too short")
                failed += 1
                continue
            
            # Clean text if requested
            if clean:
                text = clean_text(text)
            
            # Save to TXT file
            txt_filename = pdf_file.stem + ".txt"
            txt_path = output_path / txt_filename
            
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(text)
            
            logger.info(f"   ✅ {pdf_file.name} → {txt_filename} ({len(text)} chars)")
            converted += 1
            
        except Exception as e:
            logger.error(f"   ❌ {pdf_file.name}: {e}")
            failed += 1
    
    logger.info("=" * 50)
    logger.info(f"✅ Conversion completed!")
    logger.info(f"   └── Converted: {converted} files")
    logger.info(f"   └── Failed: {failed} files")
    logger.info(f"   └── Output directory: {output_dir}/")
    
    if converted > 0:
        logger.info("🚀 Ready to run: npm run index")

def main():
    parser = argparse.ArgumentParser(description='Convert PDF files to TXT for indexing')
    parser.add_argument('--pdf-dir', default='pdfs', help='Directory containing PDF files')
    parser.add_argument('--output-dir', default='content', help='Output directory for TXT files')
    parser.add_argument('--no-clean', action='store_true', help='Skip text cleaning')
    
    args = parser.parse_args()
    
    logger.info("🔄 PDF to TXT Converter for Mora + DeerFlow")
    logger.info(f"📁 PDF directory: {args.pdf_dir}")
    logger.info(f"📁 Output directory: {args.output_dir}")
    logger.info(f"🧹 Text cleaning: {'disabled' if args.no_clean else 'enabled'}")
    logger.info(f"📚 Using library: {PDF_LIBRARY}")
    
    convert_pdfs_to_txt(
        pdf_dir=args.pdf_dir,
        output_dir=args.output_dir,
        clean=not args.no_clean
    )

if __name__ == "__main__":
    main()
