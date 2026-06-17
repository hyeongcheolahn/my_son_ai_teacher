#!/usr/bin/env python3
# 개발용 정적 서버: 항상 no-store로 응답해 브라우저가 모듈을 캐시하지 않게 한다.
# (편집 후 리로드하면 바로 최신 코드가 로드됨)
import functools
import http.server
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    directory = sys.argv[1] if len(sys.argv) > 1 else '.'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8123
    handler = functools.partial(NoCacheHandler, directory=directory)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', port), handler) as httpd:
        print(f'serving {directory} at http://localhost:{port} (no-store)')
        httpd.serve_forever()
