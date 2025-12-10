import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface HealthGaugeProps {
  mentalScore: number; // 0-100
  physicalScore: number; // 0-100
}

export function HealthGauge({ mentalScore, physicalScore }: HealthGaugeProps) {
  const [displayMental, setDisplayMental] = useState(0);
  const [displayPhysical, setDisplayPhysical] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const mentalIncrement = mentalScore / steps;
    const physicalIncrement = physicalScore / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      setDisplayMental(Math.min(mentalScore, mentalIncrement * currentStep));
      setDisplayPhysical(Math.min(physicalScore, physicalIncrement * currentStep));
      
      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [mentalScore, physicalScore]);

  const getColor = (score: number) => {
    if (score < 40) return "#ef4444"; // red
    if (score < 70) return "#eab308"; // yellow
    return "#22c55e"; // green
  };

  const getGradient = (score: number) => {
    const color = getColor(score);
    return `conic-gradient(${color} ${score * 3.6}deg, #e5e7eb ${score * 3.6}deg)`;
  };

  const getStatusText = (score: number) => {
    if (score < 40) return "Требует внимания";
    if (score < 70) return "Удовлетворительно";
    return "Отлично";
  };

  return (
    <Card className="p-4">
      <h3 className="text-base font-semibold mb-4">Мониторинг состояния</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Mental Health Gauge */}
        <div className="flex flex-col items-center space-y-2">
          <div className="relative w-24 h-24">
            <div
              className="w-full h-full rounded-full transition-all duration-300 flex items-center justify-center"
              style={{
                background: getGradient(displayMental),
              }}
            >
              <div className="w-20 h-20 bg-card rounded-full flex flex-col items-center justify-center">
                <span className="text-xl font-bold" style={{ color: getColor(displayMental) }}>
                  {Math.round(displayMental)}
                </span>
                <span className="text-[10px] text-muted-foreground">из 100</span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <h4 className="text-sm font-semibold">Психическое</h4>
            <p className="text-xs text-muted-foreground">{getStatusText(displayMental)}</p>
          </div>
        </div>

        {/* Physical Health Gauge */}
        <div className="flex flex-col items-center space-y-2">
          <div className="relative w-24 h-24">
            <div
              className="w-full h-full rounded-full transition-all duration-300 flex items-center justify-center"
              style={{
                background: getGradient(displayPhysical),
              }}
            >
              <div className="w-20 h-20 bg-card rounded-full flex flex-col items-center justify-center">
                <span className="text-xl font-bold" style={{ color: getColor(displayPhysical) }}>
                  {Math.round(displayPhysical)}
                </span>
                <span className="text-[10px] text-muted-foreground">из 100</span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <h4 className="text-sm font-semibold">Физическое</h4>
            <p className="text-xs text-muted-foreground">{getStatusText(displayPhysical)}</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-3 mt-4 pt-4 border-t">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
          <span className="text-xs text-muted-foreground">Отлично</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#eab308]"></div>
          <span className="text-xs text-muted-foreground">Нормально</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
          <span className="text-xs text-muted-foreground">Тревожно</span>
        </div>
      </div>
    </Card>
  );
}
