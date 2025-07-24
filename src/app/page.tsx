export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-6">
          Aplicación SaaS de 
          <span className="block text-blue-600">Desayunos y Estancias</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Solución integral para la gestión de servicios de desayunos y hospedaje
        </p>
        <div className="bg-white rounded-lg shadow-lg px-6 py-4 inline-block">
          <span className="text-green-600 font-semibold">✓ Sistema en desarrollo</span>
        </div>
      </div>
    </div>
  );
}
