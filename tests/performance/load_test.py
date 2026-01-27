#!/usr/bin/env python3
"""
Performance test script for PDFGlide API.

This script creates test PDF files and runs load tests using various tools.
"""

import os
import sys
import subprocess
import time
from pathlib import Path

# Configuration
API_BASE = "http://localhost:8000"
TEST_DIR = Path(__file__).parent
PDF_SAMPLE_PATH = TEST_DIR / "sample.pdf"

def create_sample_pdf():
    """Create a sample PDF file using Python."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        
        c = canvas.Canvas(str(PDF_SAMPLE_PATH), pagesize=letter)
        c.setFont("Helvetica", 12)
        
        # Add some content
        for page in range(3):
            c.drawString(100, 700, f"PDFGlide Performance Test - Page {page + 1}")
            c.drawString(100, 680, "This is a sample PDF for testing purposes.")
            c.drawString(100, 660, f"Generated at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            # Add some lorem ipsum
            y = 620
            for i in range(20):
                c.drawString(100, y, f"Line {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.")
                y -= 20
                if y < 100:
                    break
            
            if page < 2:
                c.showPage()
        
        c.save()
        print(f"✅ Created sample PDF: {PDF_SAMPLE_PATH}")
        return True
    except ImportError:
        print("⚠️ reportlab not installed, creating minimal PDF manually")
        # Create a minimal valid PDF
        pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Test PDF) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
299
%%EOF"""
        PDF_SAMPLE_PATH.write_bytes(pdf_content)
        print(f"✅ Created minimal sample PDF: {PDF_SAMPLE_PATH}")
        return True


def run_health_check():
    """Check if the API is healthy."""
    import urllib.request
    import json
    
    try:
        with urllib.request.urlopen(f"{API_BASE}/health", timeout=5) as response:
            data = json.loads(response.read().decode())
            if data.get("status") == "healthy":
                print("✅ API is healthy")
                return True
    except Exception as e:
        print(f"❌ API health check failed: {e}")
        return False
    return False


def run_ab_test(endpoint: str, num_requests: int = 100, concurrency: int = 10, method: str = "GET"):
    """Run Apache Benchmark test."""
    url = f"{API_BASE}{endpoint}"
    
    cmd = ["ab", "-n", str(num_requests), "-c", str(concurrency)]
    
    if method == "GET":
        cmd.append(url)
    
    print(f"\n{'='*60}")
    print(f"Testing: {endpoint}")
    print(f"Requests: {num_requests}, Concurrency: {concurrency}")
    print(f"{'='*60}")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # Parse relevant metrics from output
    output = result.stdout
    
    metrics = {}
    for line in output.split('\n'):
        if 'Requests per second:' in line:
            metrics['requests_per_second'] = line.split(':')[1].strip()
        elif 'Time per request:' in line and 'mean' in line:
            metrics['time_per_request'] = line.split(':')[1].strip()
        elif 'Failed requests:' in line:
            metrics['failed_requests'] = line.split(':')[1].strip()
        elif 'Complete requests:' in line:
            metrics['complete_requests'] = line.split(':')[1].strip()
    
    print(f"Requests/sec: {metrics.get('requests_per_second', 'N/A')}")
    print(f"Time/request: {metrics.get('time_per_request', 'N/A')}")
    print(f"Failed: {metrics.get('failed_requests', 'N/A')}")
    
    return metrics


def run_curl_upload_test(endpoint: str, file_path: Path, num_requests: int = 10):
    """Run file upload test using curl in parallel."""
    print(f"\n{'='*60}")
    print(f"File Upload Test: {endpoint}")
    print(f"File: {file_path.name} ({file_path.stat().st_size} bytes)")
    print(f"Requests: {num_requests}")
    print(f"{'='*60}")
    
    start_time = time.time()
    processes = []
    
    # Start concurrent requests
    for i in range(num_requests):
        cmd = [
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code},%{time_total}",
            "-X", "POST",
            "-F", f"file=@{file_path}",
            "-F", "quality=medium",
            f"{API_BASE}{endpoint}"
        ]
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        processes.append(p)
    
    # Collect results
    results = []
    for p in processes:
        stdout, _ = p.communicate()
        try:
            code, time_taken = stdout.decode().strip().split(',')
            results.append({
                'status': int(code),
                'time': float(time_taken)
            })
        except:
            results.append({'status': 0, 'time': 0})
    
    end_time = time.time()
    total_time = end_time - start_time
    
    # Calculate metrics
    successful = sum(1 for r in results if 200 <= r['status'] < 300)
    failed = len(results) - successful
    avg_time = sum(r['time'] for r in results) / len(results) if results else 0
    
    print(f"Total time: {total_time:.2f}s")
    print(f"Successful: {successful}/{num_requests}")
    print(f"Failed: {failed}")
    print(f"Avg response time: {avg_time:.2f}s")
    print(f"Requests/sec: {num_requests/total_time:.2f}")
    
    return {
        'total_time': total_time,
        'successful': successful,
        'failed': failed,
        'avg_response_time': avg_time,
        'requests_per_second': num_requests/total_time
    }


def main():
    print("\n" + "="*60)
    print("PDFGlide Performance Test Suite")
    print("="*60 + "\n")
    
    # Health check
    if not run_health_check():
        print("\n❌ Cannot proceed - API is not available")
        sys.exit(1)
    
    # Create sample PDF
    create_sample_pdf()
    
    results = {}
    
    # Test 1: Health endpoint (baseline)
    print("\n📊 Test 1: Health Endpoint (Baseline)")
    results['health'] = run_ab_test("/health", num_requests=500, concurrency=50)
    
    # Test 2: Root endpoint
    print("\n📊 Test 2: Root Endpoint")
    results['root'] = run_ab_test("/", num_requests=500, concurrency=50)
    
    # Test 3: API docs
    print("\n📊 Test 3: API Documentation")
    results['docs'] = run_ab_test("/docs", num_requests=100, concurrency=10)
    
    # Test 4: PDF Compress (sync endpoint with file upload)
    print("\n📊 Test 4: PDF Compress (File Upload)")
    results['pdf_compress'] = run_curl_upload_test(
        "/api/v1/pdf/compress", 
        PDF_SAMPLE_PATH, 
        num_requests=20
    )
    
    # Test 5: Concurrent uploads
    print("\n📊 Test 5: High Concurrency File Uploads")
    results['high_concurrency'] = run_curl_upload_test(
        "/api/v1/pdf/compress",
        PDF_SAMPLE_PATH,
        num_requests=50
    )
    
    # Summary
    print("\n" + "="*60)
    print("📈 PERFORMANCE TEST SUMMARY")
    print("="*60)
    
    print(f"""
Endpoint Performance:
---------------------
Health Check:     {results.get('health', {}).get('requests_per_second', 'N/A')}
Root:             {results.get('root', {}).get('requests_per_second', 'N/A')}
Docs:             {results.get('docs', {}).get('requests_per_second', 'N/A')}

File Upload Performance:
------------------------
PDF Compress (20 req):  {results.get('pdf_compress', {}).get('requests_per_second', 'N/A'):.2f} req/s
High Concurrency (50):  {results.get('high_concurrency', {}).get('requests_per_second', 'N/A'):.2f} req/s

Success Rates:
--------------
PDF Compress:      {results.get('pdf_compress', {}).get('successful', 0)}/{20}
High Concurrency:  {results.get('high_concurrency', {}).get('successful', 0)}/{50}
""")
    
    # Cleanup
    if PDF_SAMPLE_PATH.exists():
        PDF_SAMPLE_PATH.unlink()
        print(f"🧹 Cleaned up test files")
    
    print("\n✅ Performance tests completed!")


if __name__ == "__main__":
    main()
