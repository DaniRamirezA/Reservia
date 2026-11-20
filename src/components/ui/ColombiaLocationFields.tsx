'use client';

import locations from '@/data/colombia-locations.json';

type Props = {
  department: string;
  city: string;
  onDepartmentChange: (value: string) => void;
  onCityChange: (value: string) => void;
  required?: boolean;
  compact?: boolean;
};

const departments = locations.departments;
const cities = locations.cities;

export function inferDepartment(city: string | undefined): string {
  if (!city) return '';
  const normalized = city.trim().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase();
  const match = cities.find((item) => item.name.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase() === normalized);
  return departments.find((item) => item.id === match?.departmentId)?.name ?? '';
}

export default function ColombiaLocationFields({ department, city, onDepartmentChange, onCityChange, required = false, compact = false }: Props) {
  const departmentId = departments.find((item) => item.name === department)?.id;
  const municipalityOptions = cities.filter((item) => item.departmentId === departmentId).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const labelClass = compact ? 'block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5' : 'block text-[11px] font-medium text-slate-600 mb-1.5';
  const inputClass = 'w-full bg-[#fafafa] border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#025a4e]';

  return (
    <>
      <div>
        <label className={labelClass}>Departamento{required && <span className="text-rose-500"> *</span>}</label>
        <select value={department} required={required} onChange={(e) => { onDepartmentChange(e.target.value); onCityChange(''); }} className={inputClass}>
          <option value="">Selecciona un departamento</option>
          {departments.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Municipio{required && <span className="text-rose-500"> *</span>}</label>
        <select value={city} required={required} disabled={!department} onChange={(e) => onCityChange(e.target.value)} className={inputClass}>
          <option value="">{department ? 'Selecciona un municipio' : 'Primero selecciona un departamento'}</option>
          {municipalityOptions.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          {city && department && !municipalityOptions.some((item) => item.name === city) && <option value={city}>{city}</option>}
        </select>
      </div>
    </>
  );
}
