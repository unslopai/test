export interface CalibrationReading {
    readonly sensorId: string;
    readonly reading: number;
}

export function averageReading(readings: readonly CalibrationReading[]): number {
    if (readings.length === 0) return 0;
    const readingSum = readings.reduce((runningSum, entry) => runningSum + entry.reading, 0);
    return readingSum / readings.length;
}
