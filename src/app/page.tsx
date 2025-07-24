import EmployeeSearch from './components/EmployeeSearch';
import ConceptSelector from './components/ConceptSelector';
import OrderTable from './components/OrderTable';
import PaymentCalculator from './components/PaymentCalculator';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-cyan-500 to-teal-600">
      {/* Header Navigation */}
      <header className="bg-slate-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold">Sistema de Desayunos y Estancias</h1>
              <nav className="flex space-x-6">
                <a href="#" className="text-white hover:text-cyan-300 transition-colors">
                  Ingresos
                </a>
                <a href="#" className="text-gray-300 hover:text-cyan-300 transition-colors">
                  Catálogos
                </a>
                <a href="#" className="text-gray-300 hover:text-cyan-300 transition-colors">
                  Soporte
                </a>
              </nav>
            </div>
            <div className="text-sm text-gray-300">
              Centro de ayuda • Contactar
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Panel - Employee Search & Concepts */}
            <div className="space-y-6">
              <EmployeeSearch />
              <ConceptSelector />
            </div>

            {/* Right Panel - Order Table & Payment */}
            <div className="space-y-6">
              <OrderTable />
              <PaymentCalculator />
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
