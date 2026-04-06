# scripts/merge_pdfs.py
#
# Merges a list of PDF files into a single output PDF.
#
# Usage:
#   python3 merge_pdfs.py <output_path> <pdf1> [<pdf2> ...]
#
# Strategy (in order):
#   1. Try pypdf  (modern, pip install pypdf)
#   2. Try PyPDF2 (legacy, pip install PyPDF2)
#   3. Fall back to system `pdfunite` (poppler-utils, often pre-installed)
#   4. Fall back to system `gs` (ghostscript, very common on Linux)
#
# Returns: { "success": true, "merged": N, "output": "..." }
#       OR { "success": false, "error": "..." }

import sys
import json
import os
import subprocess


def merge_with_pypdf(input_paths, output_path):
    """Attempt merge using pypdf (modern library)."""
    from pypdf import PdfWriter, PdfReader
    writer = PdfWriter()
    count  = 0
    for p in input_paths:
        reader = PdfReader(p)
        for page in reader.pages:
            writer.add_page(page)
        count += 1
    with open(output_path, 'wb') as f:
        writer.write(f)
    return count


def merge_with_pyPDF2(input_paths, output_path):
    """Attempt merge using PyPDF2 (legacy library)."""
    from PyPDF2 import PdfMerger
    merger = PdfMerger()
    count  = 0
    for p in input_paths:
        merger.append(p)
        count += 1
    with open(output_path, 'wb') as f:
        merger.write(f)
    merger.close()
    return count


def merge_with_pdfunite(input_paths, output_path):
    """Attempt merge using system pdfunite (poppler-utils)."""
    cmd = ['pdfunite'] + input_paths + [output_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"pdfunite failed: {result.stderr.strip()}")
    return len(input_paths)


def merge_with_ghostscript(input_paths, output_path):
    """Attempt merge using Ghostscript (gs)."""
    cmd = [
        'gs', '-dBATCH', '-dNOPAUSE', '-q',
        '-sDEVICE=pdfwrite',
        f'-sOutputFile={output_path}',
    ] + input_paths
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"gs failed: {result.stderr.strip()}")
    return len(input_paths)


STRATEGIES = [
    ('pypdf',       merge_with_pypdf),
    ('PyPDF2',      merge_with_pyPDF2),
    ('pdfunite',    merge_with_pdfunite),
    ('ghostscript', merge_with_ghostscript),
]


def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: merge_pdfs.py <output_path> <pdf1> [<pdf2> ...]"
        }))
        return

    output_path = sys.argv[1]
    input_paths = sys.argv[2:]

    # Ensure output directory exists
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # Filter to files that actually exist
    valid = [p for p in input_paths if os.path.isfile(p)]
    if not valid:
        print(json.dumps({"success": False, "error": "No valid input files found"}))
        return

    # Try each strategy until one works
    errors = []
    for name, fn in STRATEGIES:
        try:
            count = fn(valid, output_path)
            # Verify the output file was actually created
            if os.path.isfile(output_path) and os.path.getsize(output_path) > 0:
                print(json.dumps({
                    "success": True,
                    "merged":  count,
                    "output":  output_path,
                    "method":  name,
                }))
                return
            else:
                errors.append(f"{name}: wrote file but it is empty or missing")
        except Exception as e:
            errors.append(f"{name}: {e}")

    print(json.dumps({
        "success": False,
        "error": f"All merge strategies failed: {'; '.join(errors)}"
    }))


if __name__ == '__main__':
    main()
