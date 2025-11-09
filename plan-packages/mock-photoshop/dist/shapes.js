const SHAPE_KINDS = ['rect', 'triangle', 'circle', 'star'];
const randomBetween = (min, max) => Math.random() * (max - min) + min;
const randomMutedColor = () => {
    const hue = Math.floor(randomBetween(0, 360));
    const saturation = randomBetween(15, 35);
    const lightness = randomBetween(55, 75);
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
};
export const generateShapes = (count, width, height) => Array.from({ length: count }).map((_, index) => {
    const kind = SHAPE_KINDS[index % SHAPE_KINDS.length];
    const size = randomBetween(40, 96);
    return {
        id: `shape-${index}`,
        kind,
        size,
        x: randomBetween(size / 2, width - size / 2),
        y: randomBetween(size / 2, height - size / 2),
        rotation: randomBetween(-25, 25),
        fill: randomMutedColor(),
        stroke: 'rgba(25, 41, 85, 0.25)',
        opacity: randomBetween(0.65, 0.95),
    };
});
