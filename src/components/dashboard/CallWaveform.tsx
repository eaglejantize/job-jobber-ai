export default function CallWaveform({ active }: { active: boolean }) {
  const bars = Array.from({ length: 28 });
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {bars.map((_, i) => (
        <span
          key={i}
          className={active ? "v-bar" : ""}
          style={{
            display: "inline-block",
            width: 3,
            height: 32,
            borderRadius: 2,
            background: active
              ? `hsl(${152 + (i % 6) * 4} 84% ${50 + (i % 5) * 4}%)`
              : "hsl(222 25% 22%)",
            animationDelay: `${(i % 10) * 0.08}s`,
            opacity: active ? 0.9 : 0.4,
          }}
        />
      ))}
    </div>
  );
}