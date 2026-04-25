const DEFAULT_EMBEDDING_DIMENSIONS = 64;
const TOKEN_PATTERN = /[a-z0-9_/-]+/g;
export function embedText(text, dimensions = DEFAULT_EMBEDDING_DIMENSIONS) {
    const vector = new Array(dimensions).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) {
        return vector;
    }
    for (const token of tokens) {
        accumulateToken(vector, token, 1);
    }
    for (let index = 0; index < tokens.length - 1; index += 1) {
        accumulateToken(vector, `${tokens[index]}::${tokens[index + 1]}`, 0.6);
    }
    return normalizeVector(vector);
}
export function cosineSimilarity(left, right) {
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
        return 0;
    }
    let dotProduct = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;
    for (let index = 0; index < left.length; index += 1) {
        dotProduct += left[index] * right[index];
        leftMagnitude += left[index] * left[index];
        rightMagnitude += right[index] * right[index];
    }
    if (leftMagnitude === 0 || rightMagnitude === 0) {
        return 0;
    }
    return dotProduct / Math.sqrt(leftMagnitude * rightMagnitude);
}
function tokenize(value) {
    return (value
        .toLowerCase()
        .match(TOKEN_PATTERN)
        ?.filter((token) => token.length > 1) ?? []);
}
function accumulateToken(vector, token, weight) {
    const hash = stableHash(token);
    const dimension = Math.abs(hash) % vector.length;
    const direction = hash % 2 === 0 ? 1 : -1;
    vector[dimension] += direction * weight;
}
function normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (magnitude === 0) {
        return [...vector];
    }
    return vector.map((value) => Number((value / magnitude).toFixed(6)));
}
function stableHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash | 0;
}
//# sourceMappingURL=text-embedding.js.map