const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '0.0.0.0';
const PORT = 3000;
const ROOT_DIR = __dirname;
const STATIC_ROOT = path.join(ROOT_DIR, 'vue-app', 'dist');
const DATA_FILE = path.join(ROOT_DIR, 'user_data.json');

function ensureDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        const initial = {
            blocks: [],
            tasks: [],
            bucketKeysByType: {
                meat: ['A', 'B'],
                fruit: ['A', 'B'],
                veggie: ['A', 'B']
            },
            uiPrefs: {
                isThreeDayMode: false
            },
            bucketNames: {
                'meat-A': 'A',
                'fruit-A': 'A',
                'veggie-A': 'A',
                'meat-B': 'B',
                'fruit-B': 'B',
                'veggie-B': 'B'
            }
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(payload));
}

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') return 'text/html; charset=utf-8';
    if (ext === '.js') return 'application/javascript; charset=utf-8';
    if (ext === '.css') return 'text/css; charset=utf-8';
    if (ext === '.json') return 'application/json; charset=utf-8';
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.svg') return 'image/svg+xml';
    return 'application/octet-stream';
}

function serveStaticFile(reqPath, res) {
    const normalized = reqPath === '/' ? '/index.html' : reqPath;
    const safePath = path.normalize(normalized).replace(/^([.][.][/\\])+/, '');
    const filePath = path.join(STATIC_ROOT, safePath);

    if (!filePath.startsWith(STATIC_ROOT)) {
        sendJson(res, 403, { error: 'Forbidden' });
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
            return;
        }

        res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
        res.end(data);
    });
}

ensureDataFile();

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    if (url.pathname === '/api/state' && req.method === 'GET') {
        fs.readFile(DATA_FILE, 'utf8', (err, content) => {
            if (err) {
                sendJson(res, 500, { error: '读取数据失败' });
                return;
            }

            try {
                const parsed = JSON.parse(content);
                sendJson(res, 200, parsed);
            } catch (parseErr) {
                sendJson(res, 500, { error: '数据格式错误' });
            }
        });
        return;
    }

    if (url.pathname === '/api/state' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                req.destroy();
            }
        });

        req.on('end', () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const BUCKET_LABELS = 'ABCDEFGHIJ'.split('');
                const normalizeBucketKey = (value) => {
                    const normalized = String(value || '').trim().toUpperCase();
                    if (!BUCKET_LABELS.includes(normalized)) return null;
                    return normalized;
                };
                const normalizeBucketKeys = (rawKeys) => {
                    const source = Array.isArray(rawKeys) ? rawKeys : [];
                    const unique = [];
                    source.forEach(key => {
                        const normalized = normalizeBucketKey(key);
                        if (normalized && !unique.includes(normalized)) unique.push(normalized);
                    });

                    if (!unique.includes('A')) unique.unshift('A');
                    if (!unique.includes('B')) unique.push('B');

                    unique.sort((a, b) => BUCKET_LABELS.indexOf(a) - BUCKET_LABELS.indexOf(b));
                    return unique.slice(0, 10);
                };
                const normalizeBucketKeysByType = (rawByType) => {
                    const source = (rawByType && typeof rawByType === 'object') ? rawByType : {};
                    const fromLegacy = Array.isArray(parsed.bucketKeys) ? parsed.bucketKeys : null;
                    return {
                        meat: normalizeBucketKeys(source.meat || fromLegacy),
                        fruit: normalizeBucketKeys(source.fruit || fromLegacy),
                        veggie: normalizeBucketKeys(source.veggie || fromLegacy)
                    };
                };
                const safeBucketKeysByType = normalizeBucketKeysByType(parsed.bucketKeysByType);
                const isValidBucketForType = (type, bucket) => {
                    const safeType = (type === 'fruit' || type === 'veggie') ? type : 'meat';
                    return safeBucketKeysByType[safeType].includes(bucket);
                };

                const parsedBucketNames = (parsed.bucketNames && typeof parsed.bucketNames === 'object') ? parsed.bucketNames : {};
                const sanitizeBucketName = (value, fallback) => {
                    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
                    if (!normalized) return fallback;
                    return normalized.slice(0, 12);
                };
                const types = ['meat', 'fruit', 'veggie'];
                const safeBucketNames = {};
                types.forEach(type => {
                    safeBucketKeysByType[type].forEach(bucket => {
                        const key = `${type}-${bucket}`;
                        safeBucketNames[key] = sanitizeBucketName(parsedBucketNames[key], bucket);
                    });
                });

                if (typeof parsedBucketNames.A === 'string') {
                    types.forEach(type => {
                        const key = `${type}-A`;
                        if (safeBucketNames[key]) {
                            safeBucketNames[key] = sanitizeBucketName(parsedBucketNames.A, safeBucketNames[key]);
                        }
                    });
                }
                if (typeof parsedBucketNames.B === 'string') {
                    types.forEach(type => {
                        const key = `${type}-B`;
                        if (safeBucketNames[key]) {
                            safeBucketNames[key] = sanitizeBucketName(parsedBucketNames.B, safeBucketNames[key]);
                        }
                    });
                }

                const safeTasks = (Array.isArray(parsed.tasks) ? parsed.tasks : []).map(task => {
                    const normalized = normalizeBucketKey(task.bucket);
                    const safeType = (task.type === 'fruit' || task.type === 'veggie') ? task.type : 'meat';
                    return {
                        ...task,
                        bucket: normalized && isValidBucketForType(safeType, normalized) ? normalized : 'A'
                    };
                });

                const safeBlocks = (Array.isArray(parsed.blocks) ? parsed.blocks : []).map(block => {
                    const normalized = normalizeBucketKey(block.taskBucket);
                    const safeType = (block.type === 'fruit' || block.type === 'veggie') ? block.type : 'meat';
                    return {
                        ...block,
                        taskBucket: normalized && isValidBucketForType(safeType, normalized) ? normalized : 'A'
                    };
                });

                const safePayload = {
                    blocks: safeBlocks,
                    tasks: safeTasks,
                    bucketKeysByType: safeBucketKeysByType,
                    bucketNames: safeBucketNames,
                    uiPrefs: {
                        isThreeDayMode: Boolean(parsed.uiPrefs && parsed.uiPrefs.isThreeDayMode)
                    }
                };

                fs.writeFile(DATA_FILE, JSON.stringify(safePayload, null, 2), 'utf8', err => {
                    if (err) {
                        sendJson(res, 500, { error: '保存数据失败' });
                        return;
                    }
                    sendJson(res, 200, { ok: true });
                });
            } catch (err) {
                sendJson(res, 400, { error: '无效 JSON' });
            }
        });
        return;
    }

    serveStaticFile(url.pathname, res);
});

server.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
});
