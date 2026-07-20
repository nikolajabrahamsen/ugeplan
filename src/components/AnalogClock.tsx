interface Props {
  time: string; // "HH:MM"
  size?: number;
}

/**
 * Lille analog urskive der viser et givent klokkeslæt. Vises sammen med
 * det digitale tal, så børn der endnu ikke kan aflæse en urskive kan
 * bruge tallet, mens de der er ved at lære det får urskiven at øve på -
 * samme princip som analoge ure i mange fysiske ugeskemaer/piktogram-sæt.
 */
export default function AnalogClock({ time, size = 40 }: Props) {
  const [hoursRaw, minutesRaw] = time.split(":").map(Number);
  const hours = hoursRaw % 12;
  const minutes = minutesRaw || 0;

  const minuteAngle = minutes * 6; // 360 / 60
  const hourAngle = hours * 30 + minutes * 0.5; // 360 / 12, plus glidende fremrykning

  const center = 50;
  const hourHandLength = 22;
  const minuteHandLength = 34;

  function handPoint(angleDeg: number, length: number) {
    const angleRad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x: center + length * Math.cos(angleRad),
      y: center + length * Math.sin(angleRad)
    };
  }

  const hourPoint = handPoint(hourAngle, hourHandLength);
  const minutePoint = handPoint(minuteAngle, minuteHandLength);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="analog-clock"
      aria-hidden="true"
    >
      <circle cx={center} cy={center} r="46" className="analog-clock-face" />
      {/* Mærker for 12, 3, 6, 9 */}
      {[0, 90, 180, 270].map((angle) => {
        const outer = handPoint(angle, 44);
        const inner = handPoint(angle, 38);
        return (
          <line
            key={angle}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            className="analog-clock-tick"
          />
        );
      })}
      <line
        x1={center}
        y1={center}
        x2={hourPoint.x}
        y2={hourPoint.y}
        className="analog-clock-hand analog-clock-hour"
      />
      <line
        x1={center}
        y1={center}
        x2={minutePoint.x}
        y2={minutePoint.y}
        className="analog-clock-hand analog-clock-minute"
      />
      <circle cx={center} cy={center} r="3" className="analog-clock-center" />
    </svg>
  );
}
