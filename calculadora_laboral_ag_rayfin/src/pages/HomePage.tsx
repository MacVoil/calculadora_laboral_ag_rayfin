import { useCallback, useEffect, useState, useMemo } from 'react';

import { useAuth } from '@/hooks/AuthContext';
import {
  createTodo,
  deleteTodo,
  getTodos,
  updateTodo,
  type TodoItem,
} from '@/services/todos';
import {
  getCalculations,
  createCalculation,
  deleteCalculation,
  type CalculationItem,
} from '@/services/calculations';

// ARL Risk Classes and Rates
const ARL_CLASSES = [
  { class: 1, rate: 0.00522, label: 'Clase I (0.522%) - Oficinas, Ventas, Administrativos' },
  { class: 2, rate: 0.01044, label: 'Clase II (1.044%) - Manufactura, Confección' },
  { class: 3, rate: 0.02436, label: 'Clase III (2.436%) - Construcción, Metalurgia' },
  { class: 4, rate: 0.04350, label: 'Clase IV (4.350%) - Transporte, Carga, Logística' },
  { class: 5, rate: 0.06960, label: 'Clase V (6.960%) - Minería, Bomberos, Construcción Pesada' },
];

export function HomePage() {
  const { signOut, user } = useAuth();
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'calculator' | 'todos'>('calculator');

  // Todo app state
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [todoLoading, setTodoLoading] = useState(true);

  // Calculator inputs state
  const [salary, setSalary] = useState<number>(2000000);
  const [smmlv, setSmmlv] = useState<number>(1750905);
  const [auxTransport, setAuxTransport] = useState<number>(249095);
  const [isIntegral, setIsIntegral] = useState<boolean>(false);
  const [arlClass, setArlClass] = useState<number>(1);
  const [isExempt, setIsExempt] = useState<boolean>(true); // Exempt from Salud (8.5%), SENA (2%), ICBF (3%) if < 10 SMMLV

  // Saved calculations history state
  const [calculations, setCalculations] = useState<CalculationItem[]>([]);
  const [calcName, setCalcName] = useState('');
  const [calcLoading, setCalcLoading] = useState(true);

  // Auto-adjust exemption checkbox based on salary and SMMLV, but allow user overrides
  useEffect(() => {
    // If ordinary salary >= 10 SMMLV, or if integral salary (which is >= 13 SMMLV), set isExempt to false
    const totalWage = salary;
    if (isIntegral || totalWage >= smmlv * 10) {
      setIsExempt(false);
    } else {
      setIsExempt(true);
    }
  }, [salary, smmlv, isIntegral]);

  // Fetch data
  const fetchTodos = useCallback(async () => {
    try {
      const data = await getTodos();
      setTodos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTodoLoading(false);
    }
  }, []);

  const fetchCalculations = useCallback(async () => {
    try {
      const data = await getCalculations();
      setCalculations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCalcLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'todos') {
      void fetchTodos();
    } else {
      void fetchCalculations();
    }
  }, [activeTab, fetchTodos, fetchCalculations]);

  // Todo actions
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTodoTitle.trim();
    if (!title) return;
    setNewTodoTitle('');
    await createTodo(title);
    await fetchTodos();
  };

  const handleToggleTodo = async (id: string, isCompleted: boolean) => {
    await updateTodo(id, { isCompleted: !isCompleted });
    await fetchTodos();
  };

  const handleDeleteTodo = async (id: string) => {
    await deleteTodo(id);
    await fetchTodos();
  };

  // Calculator persistence actions
  const handleSaveCalculation = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = calcName.trim();
    if (!name) return;
    setCalcName('');
    await createCalculation({
      name,
      salary,
      smmlv,
      auxTransport,
      isIntegral,
      arlClass,
      isExempt,
    });
    await fetchCalculations();
  };

  const handleDeleteCalculation = async (id: string) => {
    await deleteCalculation(id);
    await fetchCalculations();
  };

  const handleLoadCalculation = (calc: CalculationItem) => {
    setSalary(calc.salary);
    setSmmlv(calc.smmlv);
    setAuxTransport(calc.auxTransport);
    setIsIntegral(calc.isIntegral);
    setArlClass(calc.arlClass);
    setIsExempt(calc.isExempt);
  };

  // Colombian Labor Calculations
  const calculationsData = useMemo(() => {
    const minIntegralWage = smmlv * 13;
    const isIntegralValid = isIntegral ? salary >= minIntegralWage : true;

    // 1. Auxilio de Transporte
    const atValue = (!isIntegral && salary <= smmlv * 2) ? auxTransport : 0;

    // 2. Ingreso Base de Cotización (IBC)
    const rawIbc = isIntegral ? salary * 0.70 : salary;
    // Cap IBC at 25 SMMLV, floor at 1 SMMLV
    const cappedIbc = Math.min(Math.max(rawIbc, smmlv), smmlv * 25);

    // 3. Base for Parafiscales and Vacaciones
    const baseParafiscales = isIntegral ? salary * 0.70 : salary;
    const baseVacaciones = isIntegral ? salary * 0.70 : salary;
    const basePrimaCesantias = isIntegral ? 0 : (salary + atValue);

    // 4. Prestaciones Sociales
    const prima = isIntegral ? 0 : basePrimaCesantias * 0.0833;
    const cesantias = isIntegral ? 0 : basePrimaCesantias * 0.0833;
    const interesesCesantias = isIntegral ? 0 : cesantias * 0.12;
    const vacaciones = baseVacaciones * 0.0417;
    const totalPrestaciones = prima + cesantias + interesesCesantias + vacaciones;

    // 5. Seguridad Social (Employer Part)
    const employerSalud = isExempt ? 0 : cappedIbc * 0.085;
    const employerPension = cappedIbc * 0.12;
    const arlRate = ARL_CLASSES.find(r => r.class === arlClass)?.rate || 0.00522;
    const employerArl = cappedIbc * arlRate;
    const totalSeguridadSocial = employerSalud + employerPension + employerArl;

    // 6. Parafiscales
    const cajaCompensacion = baseParafiscales * 0.04;
    const sena = isExempt ? 0 : baseParafiscales * 0.02;
    const icbf = isExempt ? 0 : baseParafiscales * 0.03;
    const totalParafiscales = cajaCompensacion + sena + icbf;

    // 7. Employer Total Cost
    const totalCostToEmployer = salary + atValue + totalPrestaciones + totalSeguridadSocial + totalParafiscales;

    // 8. Employee Deductions
    const employeeSalud = cappedIbc * 0.04;
    const employeePension = cappedIbc * 0.04;

    // Fondo de Solidaridad Pensional (FSP)
    let employeeSolidaridad = 0;
    if (cappedIbc >= smmlv * 4) {
      if (cappedIbc < smmlv * 16) {
        employeeSolidaridad = cappedIbc * 0.01;
      } else if (cappedIbc < smmlv * 17) {
        employeeSolidaridad = cappedIbc * 0.012;
      } else if (cappedIbc < smmlv * 18) {
        employeeSolidaridad = cappedIbc * 0.014;
      } else if (cappedIbc < smmlv * 19) {
        employeeSolidaridad = cappedIbc * 0.016;
      } else if (cappedIbc < smmlv * 20) {
        employeeSolidaridad = cappedIbc * 0.018;
      } else {
        employeeSolidaridad = cappedIbc * 0.02;
      }
    }
    const totalEmployeeDeductions = employeeSalud + employeePension + employeeSolidaridad;
    const netToReceive = salary + atValue - totalEmployeeDeductions;

    return {
      minIntegralWage,
      isIntegralValid,
      atValue,
      cappedIbc,
      prima,
      cesantias,
      interesesCesantias,
      vacaciones,
      totalPrestaciones,
      employerSalud,
      employerPension,
      employerArl,
      totalSeguridadSocial,
      cajaCompensacion,
      sena,
      icbf,
      totalParafiscales,
      totalCostToEmployer,
      employeeSalud,
      employeePension,
      employeeSolidaridad,
      totalEmployeeDeductions,
      netToReceive,
    };
  }, [salary, smmlv, auxTransport, isIntegral, arlClass, isExempt]);

  // Formatter for currency
  const formatCOP = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const pendingTodos = todos.filter((t) => !t.isCompleted);
  const completedTodos = todos.filter((t) => t.isCompleted);

  return (
    <div className="min-h-screen flex flex-col text-[#242424]">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-[#e0e0e0] shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-[#0f6cbd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="font-semibold text-lg tracking-tight">Portal de Nómina Rayfin</span>
          </div>
          {/* Fluent Pivot Tabs */}
          <nav className="flex gap-2">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                activeTab === 'calculator'
                  ? 'border-[#0f6cbd] text-[#0f6cbd]'
                  : 'border-transparent text-[#616161] hover:text-[#242424] hover:border-[#d0d0d0]'
              }`}
            >
              Calculadora Laboral
            </button>
            <button
              onClick={() => setActiveTab('todos')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
                activeTab === 'todos'
                  ? 'border-[#0f6cbd] text-[#0f6cbd]'
                  : 'border-transparent text-[#616161] hover:text-[#242424] hover:border-[#d0d0d0]'
              }`}
            >
              Tareas (Todo App)
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user?.email && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#e1dfdd] text-[#323130] flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                {user.email[0]}
              </div>
              <span className="text-xs text-[#616161] font-medium hidden md:inline" title={user.email}>
                {user.email}
              </span>
            </div>
          )}
          <button
            onClick={() => void signOut()}
            className="text-xs text-[#616161] hover:text-[#d13438] transition-colors border border-[#d2d2d2] hover:border-[#d13438] px-3 py-1.5 rounded bg-white hover:bg-red-50 cursor-pointer"
            aria-label="Cerrar sesión"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {activeTab === 'calculator' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left side: Inputs */}
            <div className="lg:col-span-5 space-y-6">
              <div className="fluent-card p-6">
                <h2 className="text-base font-semibold mb-5 text-[#242424] flex items-center gap-2 border-b border-[#f3f3f3] pb-3">
                  <svg className="w-4 h-4 text-[#0f6cbd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Parámetros de Liquidación
                </h2>

                {/* Validation Warnings */}
                {isIntegral && !calculationsData.isIntegralValid && (
                  <div className="bg-[#fff8f0] border-l-4 border-[#d83b01] text-[#a80000] p-4 rounded mb-6 text-xs flex gap-3 shadow-sm">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <span className="font-semibold block mb-0.5">Salario Integral por debajo del mínimo legal</span>
                      El salario integral colombiano debe ser de al menos 13 Salarios Mínimos (10 de factor salarial + 3 de factor prestacional). El mínimo requerido para 2026 es <strong>{formatCOP(calculationsData.minIntegralWage)}</strong>.
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Tipo de salario */}
                  <div>
                    <label className="block text-xs font-semibold text-[#616161] mb-2 uppercase tracking-wide">Tipo de Salario</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-[#f3f3f3] rounded border border-[#e0e0e0]">
                      <button
                        type="button"
                        onClick={() => setIsIntegral(false)}
                        className={`py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                          !isIntegral
                            ? 'bg-white text-[#0f6cbd] shadow-sm font-semibold'
                            : 'text-[#616161] hover:text-[#242424]'
                        }`}
                      >
                        Salario Ordinario
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsIntegral(true)}
                        className={`py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                          isIntegral
                            ? 'bg-white text-[#0f6cbd] shadow-sm font-semibold'
                            : 'text-[#616161] hover:text-[#242424]'
                        }`}
                      >
                        Salario Integral
                      </button>
                    </div>
                  </div>

                  {/* Valor del salario */}
                  <div>
                    <label htmlFor="salary-input" className="block text-xs font-semibold text-[#616161] mb-1.5 uppercase tracking-wide">
                      Valor del Salario Mensual (COP)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm text-[#616161] font-semibold">$</span>
                      <input
                        id="salary-input"
                        type="number"
                        min="0"
                        value={salary}
                        onChange={(e) => setSalary(Number(e.target.value))}
                        className="fluent-input w-full pl-7 py-2 text-sm"
                        placeholder="Ej. 2000000"
                      />
                    </div>
                  </div>

                  {/* ARL dropdown */}
                  <div>
                    <label htmlFor="arl-select" className="block text-xs font-semibold text-[#616161] mb-1.5 uppercase tracking-wide">
                      Clase de Riesgo ARL
                    </label>
                    <select
                      id="arl-select"
                      value={arlClass}
                      onChange={(e) => setArlClass(Number(e.target.value))}
                      className="fluent-select w-full py-2 text-sm"
                    >
                      {ARL_CLASSES.map((option) => (
                        <option key={option.class} value={option.class}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <hr className="border-[#f3f3f3] my-4" />

                  {/* Exemption details */}
                  <div className="bg-[#f9f9f9] p-3.5 rounded border border-[#e0e0e0] space-y-3">
                    <div className="flex items-start gap-2.5">
                      <input
                        id="exempt-checkbox"
                        type="checkbox"
                        checked={isExempt}
                        onChange={(e) => setIsExempt(e.target.checked)}
                        className="mt-1 h-4.5 w-4.5 border-[#8a8a8a] rounded text-[#0f6cbd] focus:ring-[#0f6cbd] cursor-pointer"
                      />
                      <label htmlFor="exempt-checkbox" className="text-xs font-medium text-[#242424] cursor-pointer select-none">
                        <strong>Exoneración de Aportes (Art. 114-1 ET)</strong>
                        <span className="block text-[#616161] text-[10px] mt-0.5 leading-relaxed">
                          Exime al empleador de pagar Salud (8.5%), SENA (2%) e ICBF (3%) por trabajadores que devenguen menos de 10 SMMLV ({formatCOP(smmlv * 10)}).
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Configuración de referencias */}
                  <details className="text-xs text-[#616161] bg-[#fafafa] border border-[#e0e0e0] rounded p-2.5">
                    <summary className="font-semibold cursor-pointer hover:text-[#242424] select-none">Configuración de Referencias (Año 2026)</summary>
                    <div className="space-y-3 mt-3 border-t border-[#e0e0e0] pt-3">
                      <div>
                        <label htmlFor="smmlv-input" className="block text-[10px] font-semibold text-[#616161] mb-1 uppercase">Salario Mínimo (SMMLV)</label>
                        <input
                          id="smmlv-input"
                          type="number"
                          value={smmlv}
                          onChange={(e) => setSmmlv(Number(e.target.value))}
                          className="fluent-input w-full py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="aux-transport-input" className="block text-[10px] font-semibold text-[#616161] mb-1 uppercase">Auxilio de Transporte</label>
                        <input
                          id="aux-transport-input"
                          type="number"
                          value={auxTransport}
                          onChange={(e) => setAuxTransport(Number(e.target.value))}
                          className="fluent-input w-full py-1 text-xs"
                        />
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              {/* Form to Save Calculation */}
              <div className="fluent-card p-6">
                <h2 className="text-base font-semibold mb-4 text-[#242424] flex items-center gap-2 border-b border-[#f3f3f3] pb-3">
                  <svg className="w-4 h-4 text-[#0f6cbd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Guardar en Historial
                </h2>
                <form onSubmit={(e) => void handleSaveCalculation(e)} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={calcName}
                    onChange={(e) => setCalcName(e.target.value)}
                    placeholder="Ej. Ingeniero de Software, Consultor"
                    className="fluent-input flex-1 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    className="bg-[#0f6cbd] hover:bg-[#0b5a97] text-white font-medium rounded text-xs px-4 py-2 transition-all cursor-pointer shadow-sm hover:shadow"
                  >
                    Guardar
                  </button>
                </form>
              </div>
            </div>

            {/* Right side: Outputs */}
            <div className="lg:col-span-7 space-y-6">
              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="fluent-card p-4.5 bg-gradient-to-br from-[#0f6cbd]/5 to-[#0f6cbd]/0 border-l-4 border-l-[#0f6cbd]">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#616161]">Costo Empleador</span>
                  <span className="block text-xl font-bold text-[#0f6cbd] mt-1">{formatCOP(calculationsData.totalCostToEmployer)}</span>
                  <span className="block text-[9px] text-[#616161] mt-0.5">Mensual estimado total</span>
                </div>
                <div className="fluent-card p-4.5 bg-gradient-to-br from-green-500/5 to-green-500/0 border-l-4 border-l-green-600">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#616161]">Neto a Recibir</span>
                  <span className="block text-xl font-bold text-green-700 mt-1">{formatCOP(calculationsData.netToReceive)}</span>
                  <span className="block text-[9px] text-[#616161] mt-0.5">Salario + Auxilio - Deducciones</span>
                </div>
                <div className="fluent-card p-4.5 bg-gradient-to-br from-[#e0e0e0] to-transparent border-l-4 border-l-[#797775]">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#616161]">Deducciones Trabajador</span>
                  <span className="block text-xl font-bold text-[#323130] mt-1">{formatCOP(calculationsData.totalEmployeeDeductions)}</span>
                  <span className="block text-[9px] text-[#616161] mt-0.5">Salud, Pensión y Solidaridad</span>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="fluent-card p-6">
                <h2 className="text-base font-semibold mb-6 text-[#242424] flex items-center justify-between border-b border-[#f3f3f3] pb-3">
                  <span>Desglose de Conceptos</span>
                  <span className="text-xs text-[#616161] font-normal">
                    IBC Cotización: <strong className="text-[#242424]">{formatCOP(calculationsData.cappedIbc)}</strong>
                  </span>
                </h2>

                <div className="space-y-6">
                  {/* Prestaciones Sociales */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs font-bold uppercase text-[#424242] tracking-wider">1. Prestaciones Sociales</h3>
                      <span className="text-sm font-bold text-[#0f6cbd]">{formatCOP(calculationsData.totalPrestaciones)}</span>
                    </div>
                    <div className="bg-[#fafafa] border border-[#e0e0e0] rounded p-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161]">Prima de Servicios (8.33%)</span>
                        <span className="font-semibold">{formatCOP(calculationsData.prima)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161]">Cesantías (8.33%)</span>
                        <span className="font-semibold">{formatCOP(calculationsData.cesantias)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161]">Intereses sobre Cesantías (1% mensual)</span>
                        <span className="font-semibold">{formatCOP(calculationsData.interesesCesantias)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161]">Vacaciones (4.17%)</span>
                        <span className="font-semibold">{formatCOP(calculationsData.vacaciones)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Seguridad Social Empleador */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs font-bold uppercase text-[#424242] tracking-wider">2. Seguridad Social (Empleador)</h3>
                      <span className="text-sm font-bold text-[#0f6cbd]">{formatCOP(calculationsData.totalSeguridadSocial)}</span>
                    </div>
                    <div className="bg-[#fafafa] border border-[#e0e0e0] rounded p-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161] flex items-center gap-1">
                          Aportes a Salud (8.5%)
                          {isExempt && <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1 rounded">Exento</span>}
                        </span>
                        <span className="font-semibold">{formatCOP(calculationsData.employerSalud)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161]">Aportes a Pensión (12%)</span>
                        <span className="font-semibold">{formatCOP(calculationsData.employerPension)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161]">ARL (Riesgo Clase {arlClass})</span>
                        <span className="font-semibold">{formatCOP(calculationsData.employerArl)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Parafiscales */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs font-bold uppercase text-[#424242] tracking-wider">3. Aportes Parafiscales</h3>
                      <span className="text-sm font-bold text-[#0f6cbd]">{formatCOP(calculationsData.totalParafiscales)}</span>
                    </div>
                    <div className="bg-[#fafafa] border border-[#e0e0e0] rounded p-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161]">Caja de Compensación Familiar (4%)</span>
                        <span className="font-semibold">{formatCOP(calculationsData.cajaCompensacion)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161] flex items-center gap-1">
                          SENA (2%)
                          {isExempt && <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1 rounded">Exento</span>}
                        </span>
                        <span className="font-semibold">{formatCOP(calculationsData.sena)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161] flex items-center gap-1">
                          ICBF (3%)
                          {isExempt && <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1 rounded">Exento</span>}
                        </span>
                        <span className="font-semibold">{formatCOP(calculationsData.icbf)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deducciones del Trabajador */}
                  <div className="border-t border-[#f3f3f3] pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-xs font-bold uppercase text-red-700 tracking-wider">4. Deducciones Mensuales del Trabajador</h3>
                      <span className="text-sm font-bold text-red-700">{formatCOP(calculationsData.totalEmployeeDeductions)}</span>
                    </div>
                    <div className="bg-red-50/20 border border-red-200/50 rounded p-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161]">Salud (4%)</span>
                        <span className="font-semibold">{formatCOP(calculationsData.employeeSalud)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#616161]">Pensión (4%)</span>
                        <span className="font-semibold">{formatCOP(calculationsData.employeePension)}</span>
                      </div>
                      {calculationsData.employeeSolidaridad > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-[#616161] flex items-center gap-1">
                            Fondo de Solidaridad Pensional (FSP)
                          </span>
                          <span className="font-semibold text-amber-800">{formatCOP(calculationsData.employeeSolidaridad)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Devengados y auxilio */}
                  <div className="border-t border-[#e0e0e0] pt-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#242424]">Salario Básico</span>
                      <span className="font-semibold text-base">{formatCOP(salary)}</span>
                    </div>
                    {calculationsData.atValue > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-green-700 flex items-center gap-1">Auxilio de Transporte</span>
                        <span className="font-semibold text-green-700">{formatCOP(calculationsData.atValue)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Calculation History */}
            <div className="lg:col-span-12">
              <div className="fluent-card p-6">
                <h2 className="text-base font-semibold mb-4 text-[#242424] flex items-center gap-2 border-b border-[#f3f3f3] pb-3">
                  <svg className="w-5 h-5 text-[#0f6cbd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Historial de Cálculos Guardados en Rayfin
                </h2>

                {calcLoading ? (
                  <p className="text-xs text-[#616161]">Cargando historial...</p>
                ) : calculations.length === 0 ? (
                  <p className="text-xs text-[#616161] py-4 text-center">No hay cálculos guardados. Ajusta los parámetros arriba y guarda el primero.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#e0e0e0] text-[#616161] font-semibold bg-[#fafafa]">
                          <th className="p-3">Nombre</th>
                          <th className="p-3">Salario</th>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Riesgo ARL</th>
                          <th className="p-3">Exento aportes</th>
                          <th className="p-3">Fecha</th>
                          <th className="p-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f3f3f3]">
                        {calculations.map((calc) => (
                          <tr key={calc.id} className="hover:bg-[#f9f9f9] transition-colors group">
                            <td className="p-3 font-semibold text-[#0f6cbd]">{calc.name}</td>
                            <td className="p-3 font-medium">{formatCOP(calc.salary)}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                calc.isIntegral 
                                  ? 'bg-purple-100 text-purple-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {calc.isIntegral ? 'Integral' : 'Ordinario'}
                              </span>
                            </td>
                            <td className="p-3">Clase {calc.arlClass}</td>
                            <td className="p-3">
                              <span className={`font-semibold ${calc.isExempt ? 'text-green-600' : 'text-gray-500'}`}>
                                {calc.isExempt ? 'Sí' : 'No'}
                              </span>
                            </td>
                            <td className="p-3 text-[#616161]">{new Date(calc.createdAt).toLocaleDateString()}</td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => handleLoadCalculation(calc)}
                                className="text-xs text-[#0f6cbd] hover:underline cursor-pointer"
                              >
                                Cargar
                              </button>
                              <button
                                onClick={() => void handleDeleteCalculation(calc.id)}
                                className="text-xs text-red-600 hover:underline cursor-pointer"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Todo App Content */
          <div className="max-w-xl mx-auto">
            <div className="fluent-card p-6">
              <h2 className="text-base font-semibold mb-4 text-[#242424] flex items-center gap-2 border-b border-[#f3f3f3] pb-3">
                <svg className="w-5 h-5 text-[#0f6cbd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Gestor de Tareas (Todo)
              </h2>

              <form
                onSubmit={(e) => void handleAddTodo(e)}
                className="flex gap-2 mb-6"
              >
                <input
                  type="text"
                  value={newTodoTitle}
                  onChange={(e) => setNewTodoTitle(e.target.value)}
                  placeholder="¿Qué tarea deseas agregar?"
                  className="fluent-input flex-1 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={!newTodoTitle.trim()}
                  className="bg-[#0f6cbd] hover:bg-[#0b5a97] text-white font-medium rounded text-sm px-4 py-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  Agregar
                </button>
              </form>

              {todoLoading ? (
                <p className="text-center text-[#616161] text-xs">Cargando tareas...</p>
              ) : todos.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[#616161] text-xs">
                    No tienes tareas creadas en Rayfin. ¡Agrega una arriba!
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {pendingTodos.length > 0 && (
                    <section>
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#616161] mb-2">
                        Pendientes ({pendingTodos.length})
                      </h3>
                      <ul className="space-y-1.5">
                        {pendingTodos.map((todo) => (
                          <TodoListItem
                            key={todo.id}
                            todo={todo}
                            onToggle={handleToggleTodo}
                            onDelete={handleDeleteTodo}
                          />
                        ))}
                      </ul>
                    </section>
                  )}

                  {completedTodos.length > 0 && (
                    <section>
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#616161] mb-2">
                        Completadas ({completedTodos.length})
                      </h3>
                      <ul className="space-y-1.5">
                        {completedTodos.map((todo) => (
                          <TodoListItem
                            key={todo.id}
                            todo={todo}
                            onToggle={handleToggleTodo}
                            onDelete={handleDeleteTodo}
                          />
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TodoListItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: TodoItem;
  onToggle: (id: string, isCompleted: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="group flex items-center gap-3 rounded border border-[#e0e0e0] bg-white px-3.5 py-2.5 shadow-sm hover:border-[#d0d0d0] transition-all">
      <button
        onClick={() => onToggle(todo.id, todo.isCompleted)}
        className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-all cursor-pointer ${
          todo.isCompleted
            ? 'border-[#0f6cbd] bg-[#0f6cbd] text-white'
            : 'border-[#8a8a8a] hover:border-[#0f6cbd]'
        }`}
        aria-label={todo.isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
      >
        {todo.isCompleted && (
          <svg
            className="h-2.5 w-2.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </button>
      <span
        className={`flex-1 text-xs transition-colors ${
          todo.isCompleted ? 'text-[#8a8a8a] line-through' : 'text-[#242424]'
        }`}
      >
        {todo.title}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        className="text-[#8a8a8a] hover:text-[#d13438] transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
        aria-label="Eliminar tarea"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </li>
  );
}
