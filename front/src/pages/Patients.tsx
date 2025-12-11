// src/pages/Patients.tsx
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type Patient = {
  id: number;
  name: string;
  mobile: string;
  address: string;
  symptoms: string;
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet("/api/patients/")
      .then((data) => {
        setPatients(data);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error(err);
        setError(err.message || "Ошибка при загрузке");
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4">Загрузка пациентов...</div>;
  if (error) return <div className="p-4 text-red-500">Ошибка: {error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Пациенты (из Django API)</h1>
      {patients.length === 0 ? (
        <div>Пока нет пациентов.</div>
      ) : (
        <ul className="space-y-2">
          {patients.map((p) => (
            <li
              key={p.id}
              className="border rounded-lg p-3 flex flex-col gap-1"
            >
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-gray-600">
                Телефон: {p.mobile || "—"}
              </div>
              <div className="text-sm text-gray-600">
                Адрес: {p.address || "—"}
              </div>
              <div className="text-sm">Жалобы: {p.symptoms || "—"}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}