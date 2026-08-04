import os
import markdown
import asyncio

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Error: 'playwright' is not installed.")
    print("Please run the following commands to install dependencies:")
    print("  pip install playwright markdown")
    print("  playwright install chromium")
    exit(1)

def convert_md_to_html(md_file):
    if not os.path.exists(md_file):
        print(f"Error: {md_file} not found.")
        return None

    with open(md_file, 'r', encoding='utf-8') as f:
        md_text = f.read()

    # Convert Markdown to HTML with tables and code blocks
    html_body = markdown.markdown(md_text, extensions=['tables', 'fenced_code'])

    # Embedded CSS for beautiful 2-column A4 layout
    css_styles = """
    @page {
        size: A4;
        margin: 1.2cm;
    }
    body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 10px;
        line-height: 1.4;
        color: #2c3e50;
        column-count: 2;
        column-gap: 25px;
        column-rule: 1px solid #ecf0f1;
        margin: 0;
        padding: 0;
    }
    h1 {
        font-size: 16px;
        text-align: center;
        color: #2980b9;
        border-bottom: 2px solid #3498db;
        padding-bottom: 5px;
        margin-bottom: 15px;
        column-span: all;
    }
    h2 {
        font-size: 12px;
        color: #2c3e50;
        border-bottom: 1px solid #bdc3c7;
        padding-bottom: 3px;
        margin-top: 15px;
        margin-bottom: 8px;
        break-after: avoid;
    }
    h3 {
        font-size: 10.5px;
        color: #34495e;
        margin-top: 10px;
        margin-bottom: 5px;
        break-after: avoid;
    }
    p {
        margin-top: 0;
        margin-bottom: 8px;
        text-align: justify;
    }
    ul, ol {
        margin-top: 0;
        margin-bottom: 8px;
        padding-left: 15px;
    }
    li {
        margin-bottom: 4px;
    }
    strong {
        color: #1f3a52;
        background-color: #f4f8fa;
        padding: 0 2px;
        border-radius: 2px;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 10px;
        font-size: 8.5px;
        break-inside: avoid;
    }
    th, td {
        border: 1px solid #bdc3c7;
        padding: 5px;
        text-align: left;
    }
    th {
        background-color: #ecf0f1;
        color: #2c3e50;
        font-weight: bold;
    }
    img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 10px auto;
        border: 1px solid #dcdde1;
        border-radius: 4px;
        break-inside: avoid;
    }
    code {
        font-family: 'Courier New', Courier, monospace;
        background-color: #f8f9fa;
        color: #c0392b;
        padding: 1px 3px;
        border-radius: 2px;
        font-size: 8.5px;
    }
    em {
        font-size: 9px;
        color: #555;
    }
    hr {
        border: 0;
        height: 1px;
        background: #ecf0f1;
        margin: 15px 0;
    }
    /* Wrap images in a div to ensure they don't break across columns */
    .img-wrapper {
        break-inside: avoid;
        margin: 10px 0;
    }
    """

    # Combine HTML structure
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            {css_styles}
        </style>
    </head>
    <body>
        {html_body}
    </body>
    </html>
    """
    return html_content

async def generate_pdf(html_content, pdf_file):
    print("Launching headless browser to generate PDF...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Load HTML content
        # Set base path so local images can load properly
        base_dir = f"file://{os.path.abspath(os.path.dirname(__file__))}/"
        await page.set_content(html_content, base_url=base_dir, wait_until="networkidle")
        
        # Generate PDF
        await page.pdf(
            path=pdf_file,
            format="A4",
            print_background=True,
            margin={"top": "1.2cm", "bottom": "1.2cm", "left": "1.2cm", "right": "1.2cm"}
        )
        
        await browser.close()
    print(f"Success! PDF generated at: {pdf_file}")

if __name__ == "__main__":
    md_filename = "automata_notes.md"
    pdf_filename = "automata_notes.pdf"
    
    print("Starting conversion process...")
    html_out = convert_md_to_html(md_filename)
    if html_out:
        # Run the async playwright function
        asyncio.run(generate_pdf(html_out, pdf_filename))
