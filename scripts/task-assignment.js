function getVisibleTasksForBlock(block) {
    const blockTaskIds = Array.isArray(block.taskIds) ? block.taskIds : [];
    return blockTaskIds
        .map(taskId => tasks.find(t => t.id === taskId))
        .filter(task => task && !task.completed)
        .slice(0, 3);
}

function getRequiredBlockContentHeight(block, visibleLimit = 3) {
    const safeLimit = Math.max(0, Math.min(3, Number(visibleLimit) || 0));
    const visibleCount = getVisibleTasksForBlock(block).slice(0, safeLimit).length;
    return 66 + (visibleCount * 26);
}

function autoAssignTasks() {
    const normalizeBucket = (value) => {
        if (typeof normalizeBucketKey === 'function') return normalizeBucketKey(value);
        return String(value || '').trim().toUpperCase() || 'A';
    };
    const toValidBucket = (type, value) => {
        const normalized = normalizeBucket(value);
        if (typeof isValidBucketForType === 'function') {
            return isValidBucketForType(type, normalized) ? normalized : 'A';
        }
        return normalized || 'A';
    };

    blocks.forEach(block => {
        block.taskIds = [];
        block.taskBucket = toValidBucket(block.type, block.taskBucket);
    });
    tasks.forEach(task => {
        task.blockIds = [];
        task.bucket = toValidBucket(task.type, task.bucket);
    });

    const pendingTasks = tasks.filter(t => !t.completed);
    const groupKeys = Array.from(new Set([
        ...pendingTasks.map(t => `${t.type}|${t.bucket}`),
        ...blocks.map(b => `${b.type}|${toValidBucket(b.type, b.taskBucket)}`)
    ]));

    groupKeys.forEach(groupKey => {
        const [type, bucket] = groupKey.split('|');
        const topTaskIds = pendingTasks
            .filter(task => task.type === type && task.bucket === bucket)
            .slice(0, 3)
            .map(task => task.id);

        if (topTaskIds.length === 0) return;

        const sameGroupBlocks = blocks.filter(block => block.type === type && (block.taskBucket || 'A') === bucket);
        sameGroupBlocks.forEach(block => {
            block.taskIds = topTaskIds.slice();
        });

        const sameGroupBlockIds = sameGroupBlocks.map(block => block.id);
        pendingTasks
            .filter(task => topTaskIds.includes(task.id) && task.type === type && task.bucket === bucket)
            .forEach(task => {
                task.blockIds = sameGroupBlockIds.slice();
            });
    });
}
