const STORAGE_KEY = 'time_manager_demo_state_v1';
const API_STATE_URL = '/api/state';

async function saveState() {
    const payload = {
        blocks,
        tasks,
        bucketNames,
        bucketKeysByType,
        uiPrefs: {
            isThreeDayMode: Boolean(isThreeDayMode)
        }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    try {
        const res = await fetch(API_STATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            throw new Error(`保存失败: HTTP ${res.status}`);
        }
    } catch (err) {
        console.warn('保存到本地 Node 接口失败，已保存在浏览器本地。', err);
    }
}

async function loadState() {
    const reconcileState = () => {
        if (typeof normalizeBucketKeysByType === 'function') {
            bucketKeysByType = normalizeBucketKeysByType(bucketKeysByType);
        }

        const toValidBucket = (type, value) => {
            if (typeof normalizeBucketKey === 'function') {
                const normalized = normalizeBucketKey(value);
                if (typeof isValidBucketForType === 'function') {
                    return isValidBucketForType(type, normalized) ? normalized : 'A';
                }
                return normalized || 'A';
            }
            const normalized = String(value || '').trim().toUpperCase();
            return normalized || 'A';
        };

        blocks.forEach(block => {
            if (!Array.isArray(block.taskIds)) block.taskIds = [];
            block.taskIds = block.taskIds.filter(taskId => {
                const linkedTask = tasks.find(t => t.id === taskId);
                return linkedTask && !linkedTask.completed;
            }).slice(0, 3);
            block.taskBucket = toValidBucket(block.type, block.taskBucket);
        });

        tasks.forEach(task => {
            if (!Array.isArray(task.blockIds)) task.blockIds = [];
            task.bucket = toValidBucket(task.type, task.bucket);
            if (task.completed) task.blockIds = [];
        });

        if (typeof ensureBasketNameKeys === 'function') {
            bucketNames = ensureBasketNameKeys(bucketNames);
        }

        isThreeDayMode = Boolean(isThreeDayMode);
    };

    const readBucketNamesFromLocal = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            if (!parsed.bucketNames || typeof parsed.bucketNames !== 'object') return null;
            return parsed.bucketNames;
        } catch (err) {
            return null;
        }
    };

    const readBucketKeysFromLocal = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            if (!parsed.bucketKeysByType || typeof parsed.bucketKeysByType !== 'object') return null;
            return parsed.bucketKeysByType;
        } catch (err) {
            return null;
        }
    };

    const readLegacyBucketKeys = source => {
        if (!Array.isArray(source)) return null;
        return { meat: source, fruit: source, veggie: source };
    };

    try {
        const res = await fetch(API_STATE_URL, { method: 'GET' });
        if (res.ok) {
            const parsed = await res.json();
            if (Array.isArray(parsed.blocks)) {
                blocks = parsed.blocks.map(b => ({
                    ...b,
                    taskIds: Array.isArray(b.taskIds) ? b.taskIds : (b.taskId ? [b.taskId] : [])
                }));
            }
            if (Array.isArray(parsed.tasks)) {
                tasks = parsed.tasks.map(t => ({
                    ...t,
                    title: String(t.title || t.name || '').split(/\r?\n/)[0].trim(),
                    detail: t.detail || (typeof t.name === 'string' ? t.name.split(/\r?\n/).slice(1).join('\n').trim() : ''),
                    bucket: t.bucket || 'A',
                    completed: Boolean(t.completed),
                    createdAt: t.createdAt || null,
                    blockIds: Array.isArray(t.blockIds) ? t.blockIds : (t.blockId ? [t.blockId] : [])
                }));
            }
            if (parsed.bucketKeysByType && typeof parsed.bucketKeysByType === 'object') {
                bucketKeysByType = parsed.bucketKeysByType;
            } else if (Array.isArray(parsed.bucketKeys)) {
                const legacy = readLegacyBucketKeys(parsed.bucketKeys);
                if (legacy) bucketKeysByType = legacy;
            } else {
                const localBucketKeys = readBucketKeysFromLocal();
                if (localBucketKeys) {
                    bucketKeysByType = localBucketKeys;
                } else if (Array.isArray(parsed.bucketKeys)) {
                    const legacy = readLegacyBucketKeys(parsed.bucketKeys);
                    if (legacy) bucketKeysByType = legacy;
                }
            }
            if (parsed.bucketNames && typeof parsed.bucketNames === 'object') {
                bucketNames = parsed.bucketNames;
            } else {
                const localBucketNames = readBucketNamesFromLocal();
                if (localBucketNames) bucketNames = localBucketNames;
            }
            if (parsed.uiPrefs && typeof parsed.uiPrefs === 'object') {
                isThreeDayMode = Boolean(parsed.uiPrefs.isThreeDayMode);
            }
            reconcileState();
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                blocks,
                tasks,
                bucketNames,
                bucketKeysByType,
                uiPrefs: { isThreeDayMode }
            }));
            return;
        }
    } catch (err) {
        console.warn('读取 Node 接口失败，尝试读取浏览器本地数据。', err);
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.blocks)) {
            blocks = parsed.blocks.map(b => ({
                ...b,
                taskIds: Array.isArray(b.taskIds) ? b.taskIds : (b.taskId ? [b.taskId] : [])
            }));
        }
        if (Array.isArray(parsed.tasks)) {
            tasks = parsed.tasks.map(t => ({
                ...t,
                title: String(t.title || t.name || '').split(/\r?\n/)[0].trim(),
                detail: t.detail || (typeof t.name === 'string' ? t.name.split(/\r?\n/).slice(1).join('\n').trim() : ''),
                bucket: t.bucket || 'A',
                completed: Boolean(t.completed),
                createdAt: t.createdAt || null,
                blockIds: Array.isArray(t.blockIds) ? t.blockIds : (t.blockId ? [t.blockId] : [])
            }));
        }
        if (parsed.bucketKeysByType && typeof parsed.bucketKeysByType === 'object') {
            bucketKeysByType = parsed.bucketKeysByType;
        } else if (Array.isArray(parsed.bucketKeys)) {
            const legacy = readLegacyBucketKeys(parsed.bucketKeys);
            if (legacy) bucketKeysByType = legacy;
        }
        if (parsed.bucketNames && typeof parsed.bucketNames === 'object') {
            bucketNames = parsed.bucketNames;
        }
        if (parsed.uiPrefs && typeof parsed.uiPrefs === 'object') {
            isThreeDayMode = Boolean(parsed.uiPrefs.isThreeDayMode);
        }
    } catch (err) {
        console.warn('读取本地数据失败，已使用空数据启动。', err);
        blocks = [];
        tasks = [];
    }

    reconcileState();
}
