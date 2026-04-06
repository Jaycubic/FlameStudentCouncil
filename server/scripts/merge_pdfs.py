# scripts/merge_pdfs.py
#
# Merges a list of PDF files into a single output PDF.
#
# Usage:
#   python3 merge_pdfs.py <output_path> <pdf1> [<pdf2> ...]
#
# Returns: { "success": true, "merged": N, "output": "..." }
#       OR { "success": false, "error": "..." }

import sys
import json
import os

try:
    from pypdf import PdfWriter, PdfReader
except ImportError:
    try:
        from PyPDF2 import PdfWriter, PdfReader
    except ImportError:
        print(json.dumps({"success": False, "error": "pypdf or PyPDF2 not installed. Run: pip3 install pypdf"}))
        sys.exit(1)


def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: merge_pdfs.py <output_path> <pdf1> [<pdf2> ...]"
        }))
        return

    output_path  = sys.argv[1]
    input_paths  = sys.argv[2:]

    # Ensure output directory exists
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    writer       = PdfWriter()
    merged_count = 0

    for input_path in input_paths:
        if not os.path.isfile(input_path):
            print(f"[WARN] Skipping missing file: {input_path}", file=sys.stderr)
            continue
        try:
            reader = PdfReader(input_path)
            for page in reader.pages:
                writer.add_page(page)
            merged_count += 1
        except Exception as e:
            print(f"[WARN] Could not read {input_path}: {e}", file=sys.stderr)

    if merged_count == 0:
        print(json.dumps({"success": False, "error": "No valid PDF files found to merge"}))
        return

    try:
        with open(output_path, 'wb') as out:
            writer.write(out)
        print(json.dumps({"success": True, "merged": merged_count, "output": output_path}))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Failed to write output PDF: {e}"}))


if __name__ == '__main__':
    main()
