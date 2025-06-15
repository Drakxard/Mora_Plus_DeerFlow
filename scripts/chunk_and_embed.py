#!/usr/bin/env python3
"""
Optimized Chunk and Embed Script for Mora + DeerFlow
Processes all .txt files in content/ directory and creates embeddings index
Now with multiprocessing support for faster processing
"""

import os
import json
import re
import argparse
import logging
from pathlib import Path
from sentence_transformers import SentenceTransformer
import numpy as np
from multiprocessing import Pool, cpu_count
from functools import partial
import time

# PDF processing imports
try:
    import PyPDF2
    PDF_AVAILABLE = True
    PDF_LIBRARY = 'PyPDF2'
except ImportError:
    try:
        import pdfplumber
        PDF_AVAILABLE = True
        PDF_LIBRARY = 'pdfplumber'
    except ImportError:
        try:
            from pdfminer.high_level import extract_text as pdfminer_extract
            PDF_AVAILABLE = True
            PDF_LIBRARY = 'pdfminer'
        except ImportError:
            PDF_AVAILABLE = False
            PDF_LIBRARY = None

# Configure logging - Windows compatible version
log_dir = Path('logs')
log_dir.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / 'chunk_and_embed.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def load_model():
    """Load the sentence transformer model"""
    logger.info("Loading sentence transformer model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    logger.info("Model loaded successfully")
    return model

def chunk_text(text, min_length=100, max_length=500):
    """
    Split text into semantic chunks based on paragraphs and sentences
    """
    if not text or len(text.strip()) < min_length:
        return []
    
    # Split by double line breaks (paragraphs)
    paragraphs = re.split(r'\n\s*\n', text.strip())
    
    valid_chunks = []
    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        
        # Skip short paragraphs
        if len(paragraph) < min_length:
            continue
            
        # Clean up whitespace
        paragraph = re.sub(r'\s+', ' ', paragraph)
        
        # If paragraph is too long, split by sentences
        if len(paragraph) > max_length:
            sentences = re.split(r'[.!?]+', paragraph)
            current_chunk = ""
            
            for sentence in sentences:
                sentence = sentence.strip()
                if not sentence:
                    continue
                    
                # Check if adding sentence would exceed max_length
                if len(current_chunk) + len(sentence) > max_length and current_chunk:
                    if len(current_chunk) >= min_length:
                        valid_chunks.append(current_chunk.strip())
                    current_chunk = sentence
                else:
                    current_chunk += (" " + sentence if current_chunk else sentence)
            
            # Add remaining chunk if valid
            if current_chunk and len(current_chunk) >= min_length:
                valid_chunks.append(current_chunk.strip())
        else:
            valid_chunks.append(paragraph)
    
    return valid_chunks

def extract_text_from_pdf(file_path):
    """Extract text from PDF using available library"""
    if not PDF_AVAILABLE:
        logger.warning(f"PDF support not available. Install: pip install PyPDF2 pdfplumber")
        return ""
    
    logger.info(f"Extracting PDF text using {PDF_LIBRARY}: {file_path.name}")
    
    try:
        if PDF_LIBRARY == 'PyPDF2':
            return extract_text_pypdf2(file_path)
        elif PDF_LIBRARY == 'pdfplumber':
            return extract_text_pdfplumber(file_path)
        elif PDF_LIBRARY == 'pdfminer':
            return extract_text_pdfminer(file_path)
    except Exception as e:
        logger.error(f"Error extracting PDF {file_path.name}: {e}")
        return ""
    
    return ""

def extract_text_pypdf2(pdf_path):
    """Extract text using PyPDF2"""
    text = ""
    with open(pdf_path, 'rb') as file:
        pdf_reader = PyPDF2.PdfReader(file)
        for page_num, page in enumerate(pdf_reader.pages):
            page_text = page.extract_text()
            if page_text.strip():
                text += f"\n{page_text}\n"
    return text.strip()

def extract_text_pdfplumber(pdf_path):
    """Extract text using pdfplumber (better for complex layouts)"""
    import pdfplumber
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text and page_text.strip():
                text += f"\n{page_text}\n"
    return text.strip()

def extract_text_pdfminer(pdf_path):
    """Extract text using pdfminer"""
    text = pdfminer_extract(str(pdf_path))
    return text.strip() if text else ""

def process_file(file_info):
    """
    Process a single file (for multiprocessing)
    Now supports both TXT and PDF files
    Returns tuple of (file_path, chunks, processing_time)
    """
    file_path, min_length, max_length = file_info
    start_time = time.time()
    
    try:
        file_ext = file_path.suffix.lower()
        logger.info(f"Processing {file_ext.upper()}: {file_path.name}")
        
        if file_ext == '.pdf':
            # Process PDF
            if not PDF_AVAILABLE:
                logger.error(f"PDF support not available for {file_path.name}")
                return file_path.name, [], 0
            
            content = extract_text_from_pdf(file_path)
            if not content:
                logger.warning(f"No text extracted from {file_path.name}")
                return file_path.name, [], 0
            
            chunks = chunk_text(content, min_length, max_length)
            
        elif file_ext == '.txt':
            # Process TXT (existing logic)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            chunks = chunk_text(content, min_length, max_length)
            
        else:
            logger.warning(f"Unsupported file type: {file_path.name}")
            return file_path.name, [], 0
        
        processing_time = time.time() - start_time
        logger.info(f"   └── Generated {len(chunks)} chunks in {processing_time:.2f}s")
        
        # Add filename metadata to chunks
        chunk_objects = []
        for i, chunk in enumerate(chunks):
            chunk_objects.append({
                'text': chunk,
                'source': file_path.name,
                'chunk_id': f"{file_path.stem}_{i}",
                'length': len(chunk),
                'file_type': file_ext[1:],  # Remove the dot
                'chunk_index': i
            })
        
        return file_path.name, chunk_objects, processing_time
        
    except Exception as e:
        logger.error(f"Error processing {file_path.name}: {e}")
        return file_path.name, [], 0

def read_content_files(content_dir, parallel=False, min_length=100, max_length=500):
    """Read all .txt and .pdf files from content directory"""
    content_path = Path(content_dir)
    
    if not content_path.exists():
        logger.info(f"Creating content directory: {content_dir}")
        content_path.mkdir(parents=True, exist_ok=True)
        
        # Create example content file
        example_file = content_path / "example.txt"
        example_content = """Introducción al Aprendizaje Automático

El aprendizaje automático es una rama de la inteligencia artificial que permite a las computadoras aprender y mejorar automáticamente a través de la experiencia sin ser programadas explícitamente.

Tipos de Aprendizaje Automático:

1. Aprendizaje Supervisado: Utiliza datos etiquetados para entrenar modelos que pueden hacer predicciones sobre nuevos datos.

2. Aprendizaje No Supervisado: Encuentra patrones ocultos en datos sin etiquetas, como clustering y reducción de dimensionalidad.

3. Aprendizaje por Refuerzo: El agente aprende a través de interacciones con un entorno, recibiendo recompensas o penalizaciones.

Aplicaciones Comunes:
- Reconocimiento de imágenes
- Procesamiento de lenguaje natural
- Sistemas de recomendación
- Detección de fraudes
- Vehículos autónomos

El aprendizaje automático está transformando industrias enteras y creando nuevas oportunidades en tecnología, medicina, finanzas y muchos otros campos."""
        
        with open(example_file, 'w', encoding='utf-8') as f:
            f.write(example_content)
        
        logger.info(f"Created example content file: {example_file}")
        return []
    
    # Find both TXT and PDF files
    txt_files = list(content_path.glob("*.txt"))
    pdf_files = list(content_path.glob("*.pdf"))
    all_files = txt_files + pdf_files
    
    if not all_files:
        logger.warning(f"No .txt or .pdf files found in {content_dir}")
        logger.info(f"Add .txt or .pdf files to {content_dir}/ directory")
        return []
    
    logger.info(f"Found {len(txt_files)} TXT files and {len(pdf_files)} PDF files to process")
    
    if pdf_files and not PDF_AVAILABLE:
        logger.warning(f"Found {len(pdf_files)} PDF files but PDF support not available")
        logger.info(f"Install PDF support: pip install PyPDF2 pdfplumber")
    
    all_chunks = []
    total_processing_time = 0
    
    if parallel and len(all_files) > 1:
        # Parallel processing
        num_processes = min(cpu_count(), len(all_files))
        logger.info(f"Using {num_processes} processes for parallel processing")
        
        # Prepare file info for multiprocessing
        file_infos = [(file_path, min_length, max_length) for file_path in all_files]
        
        with Pool(processes=num_processes) as pool:
            results = pool.map(process_file, file_infos)
        
        # Collect results
        for filename, chunks, processing_time in results:
            all_chunks.extend(chunks)
            total_processing_time += processing_time
            
    else:
        # Sequential processing
        logger.info("Using sequential processing")
        
        for file_path in all_files:
            filename, chunks, processing_time = process_file((file_path, min_length, max_length))
            all_chunks.extend(chunks)
            total_processing_time += processing_time
    
    logger.info(f"Processed {len(all_files)} files in {total_processing_time:.2f}s")
    logger.info(f"Total chunks generated: {len(all_chunks)}")
    
    return all_chunks

def create_embeddings_batch(model, chunks, batch_size=32):
    """Create embeddings for chunks in batches"""
    if not chunks:
        return [], []
    
    texts = [chunk['text'] for chunk in chunks]
    total_batches = (len(texts) + batch_size - 1) // batch_size
    
    logger.info(f"Creating embeddings for {len(texts)} chunks in {total_batches} batches...")
    
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        
        logger.info(f"   Processing batch {batch_num}/{total_batches} ({len(batch_texts)} texts)")
        
        start_time = time.time()
        batch_embeddings = model.encode(batch_texts, show_progress_bar=False)
        batch_time = time.time() - start_time
        
        all_embeddings.extend(batch_embeddings)
        
        logger.info(f"   └── Batch {batch_num} completed in {batch_time:.2f}s")
    
    # Convert to list for JSON serialization
    embeddings_list = [embedding.tolist() for embedding in all_embeddings]
    
    return texts, embeddings_list

def save_index(texts, embeddings, chunks_metadata, output_path):
    """Save the embeddings index to JSON file with enhanced metadata"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Calculate statistics
    chunk_lengths = [len(text) for text in texts]
    avg_length = sum(chunk_lengths) / len(chunk_lengths) if chunk_lengths else 0
    
    # Group by source file
    sources = {}
    for chunk in chunks_metadata:
        source = chunk['source']
        if source not in sources:
            sources[source] = 0
        sources[source] += 1
    
    index_data = {
        'texts': texts,
        'embeddings': embeddings,
        'metadata': {
            'model': 'all-MiniLM-L6-v2',
            'total_chunks': len(texts),
            'created_at': str(np.datetime64('now')),
            'embedding_dim': len(embeddings[0]) if embeddings else 0,
            'processing_stats': {
                'avg_chunk_length': round(avg_length, 2),
                'min_chunk_length': min(chunk_lengths) if chunk_lengths else 0,
                'max_chunk_length': max(chunk_lengths) if chunk_lengths else 0,
                'total_sources': len(sources),
                'sources': sources
            },
            'version': '7.0.0-local'
        },
        'chunks_metadata': chunks_metadata
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Index saved to: {output_path}")
    logger.info(f"Statistics:")
    logger.info(f"   └── Total chunks: {len(texts)}")
    logger.info(f"   └── Average length: {avg_length:.1f} characters")
    logger.info(f"   └── Sources: {len(sources)}")
    logger.info(f"   └── Embedding dimension: {len(embeddings[0]) if embeddings else 0}")

def main():
    """Main execution function with argument parsing"""
    parser = argparse.ArgumentParser(description='Chunk and embed text files for semantic search')
    parser.add_argument('--parallel', action='store_true', help='Use parallel processing')
    parser.add_argument('--content-dir', default='content', help='Content directory path')
    parser.add_argument('--output', default='embeddings/index.json', help='Output index file path')
    parser.add_argument('--min-length', type=int, default=100, help='Minimum chunk length')
    parser.add_argument('--max-length', type=int, default=500, help='Maximum chunk length')
    parser.add_argument('--batch-size', type=int, default=32, help='Embedding batch size')
    
    args = parser.parse_args()
    
    logger.info("Starting Mora + DeerFlow Chunking and Embedding Process")
    logger.info("Supports: .txt and .pdf files")
    if PDF_AVAILABLE:
        logger.info(f"PDF Library: {PDF_LIBRARY}")
    else:
        logger.info("PDF support not available (install: pip install PyPDF2)")
    logger.info("=" * 60)
    logger.info(f"Configuration:")
    logger.info(f"   └── Content directory: {args.content_dir}")
    logger.info(f"   └── Output file: {args.output}")
    logger.info(f"   └── Parallel processing: {args.parallel}")
    logger.info(f"   └── Chunk length: {args.min_length}-{args.max_length} chars")
    logger.info(f"   └── Batch size: {args.batch_size}")
    
    start_time = time.time()
    
    try:
        # Load model
        model = load_model()
        
        # Read and chunk content
        chunks = read_content_files(
            args.content_dir, 
            parallel=args.parallel,
            min_length=args.min_length,
            max_length=args.max_length
        )
        
        if not chunks:
            logger.warning("No content to process. Add .txt files to the content/ directory.")
            return
        
        # Create embeddings
        texts, embeddings = create_embeddings_batch(model, chunks, args.batch_size)
        
        # Save index
        save_index(texts, embeddings, chunks, args.output)
        
        total_time = time.time() - start_time
        
        logger.info("=" * 60)
        logger.info("Process completed successfully!")
        logger.info(f"Ready for semantic search with {len(texts)} indexed chunks")
        logger.info(f"Total processing time: {total_time:.2f} seconds")
        
        # Performance summary
        if chunks:
            chunks_per_second = len(chunks) / total_time
            logger.info(f"Performance: {chunks_per_second:.1f} chunks/second")
        
    except Exception as e:
        logger.error(f"Error during processing: {e}")
        raise

if __name__ == "__main__":
    main()
