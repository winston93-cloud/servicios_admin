# Desayunos POS - Sistema de Punto de Venta SaaS

Un sistema moderno de punto de venta especializado en la venta de desayunos, desarrollado con tecnologías web actuales y escalables.

## 🚀 Tecnologías

### Backend
- **Node.js** con **Express** y **TypeScript**
- **API RESTful** con manejo de errores robusto
- **Datos mock** para desarrollo (migración futura a Supabase/PostgreSQL)

### Frontend
- **React 18** con **TypeScript**
- **Tailwind CSS** para estilos modernos y responsivos
- **Zustand** para manejo de estado global
- **React Router** para navegación
- **Axios** para comunicación con la API
- **React Hot Toast** para notificaciones
- **Lucide React** para iconos

### Herramientas de Desarrollo
- **Vite** para desarrollo rápido
- **ESLint** para calidad de código
- **Concurrently** para ejecutar backend y frontend simultáneamente

## 📁 Estructura del Proyecto

```
desayunos/
├── backend/                    # Servidor Node.js/Express
│   ├── src/
│   │   ├── index.ts           # Punto de entrada del servidor
│   │   ├── types/             # Tipos TypeScript compartidos
│   │   ├── data/              # Datos mock
│   │   └── routes/            # Rutas de la API
│   │       ├── employees.ts   # API de empleados
│   │       ├── products.ts    # API de productos
│   │       └── orders.ts      # API de órdenes
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # Aplicación React
│   ├── src/
│   │   ├── components/        # Componentes React
│   │   │   ├── layout/        # Componentes de layout
│   │   │   └── pos/           # Componentes específicos del POS
│   │   ├── pages/             # Páginas principales
│   │   ├── store/             # Estado global (Zustand)
│   │   ├── services/          # Servicios de API
│   │   ├── types/             # Tipos TypeScript
│   │   └── App.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── package.json               # Configuración raíz del proyecto
```

## 🛠️ Instalación y Configuración

### 1. Instalar dependencias

```bash
# Instalar todas las dependencias (raíz, backend y frontend)
npm run install:all
```

### 2. Configurar variables de entorno

```bash
# Backend - copiar archivo de ejemplo
cd backend
cp .env.example .env
```

### 3. Ejecutar en modo desarrollo

```bash
# Desde la raíz del proyecto
npm run dev
```

Esto iniciará:
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:3000

## 🎯 Funcionalidades Principales

### ✅ Búsqueda de Empleados
- Búsqueda por nombre con autocompletado
- Filtrado por departamento
- Selección de empleado para procesar órdenes

### ✅ Gestión de Productos
- Catálogo de desayunos y productos relacionados
- Filtrado por categorías (Desayunos, Bebidas, Antojitos, Panadería)
- Búsqueda por nombre o descripción
- Agregado rápido al carrito

### ✅ Carrito de Compras
- Gestión de cantidades
- Cálculo automático de totales
- Múltiples métodos de pago (Efectivo, Tarjeta, Transferencia)
- Cálculo de cambio para pagos en efectivo

### ✅ Procesamiento de Órdenes
- Creación de órdenes completas
- Historial de órdenes
- Estados de órdenes (Pendiente, Completada, Cancelada)

## 🔌 API Endpoints

### Empleados
- `GET /api/employees` - Obtener empleados (con búsqueda)
- `GET /api/employees/:id` - Obtener empleado por ID
- `GET /api/employees/meta/departments` - Obtener departamentos

### Productos
- `GET /api/products` - Obtener productos (con filtros)
- `GET /api/products/:id` - Obtener producto por ID
- `GET /api/products/meta/categories` - Obtener categorías

### Órdenes
- `POST /api/orders` - Crear nueva orden
- `GET /api/orders` - Obtener historial de órdenes
- `GET /api/orders/:id` - Obtener orden por ID
- `PATCH /api/orders/:id` - Actualizar estado de orden

### Salud del Sistema
- `GET /api/health` - Verificar estado del servidor

## 🎨 Características de la Interfaz

### Diseño Moderno
- Interfaz inspirada en las mejores prácticas de UX/UI
- Gradientes y efectos visuales atractivos
- Iconografía consistente con Lucide React
- Diseño responsivo para diferentes dispositivos

### Experiencia de Usuario
- Búsqueda en tiempo real con autocompletado
- Notificaciones toast para feedback inmediato
- Animaciones suaves y transiciones
- Estados de carga y manejo de errores

### Accesibilidad
- Colores con buen contraste
- Navegación por teclado
- Estados visuales claros para interacciones

## 🔮 Roadmap - Próximas Funcionalidades

### Base de Datos
- [ ] Migración de datos mock a **Supabase** (PostgreSQL)
- [ ] Implementación de autenticación de usuarios
- [ ] Sistema de roles y permisos

### Funcionalidades Avanzadas
- [ ] Reportes y analíticas de ventas
- [ ] Inventario en tiempo real
- [ ] Descuentos y promociones
- [ ] Impresión de tickets
- [ ] Integración con sistemas de pago

### Deployment
- [ ] Configuración para **Vercel**
- [ ] CI/CD automatizado
- [ ] Monitoreo de aplicación

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu funcionalidad (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🙋‍♂️ Soporte

Si tienes preguntas o necesitas ayuda, por favor abre un [issue](https://github.com/tu-usuario/desayunos-pos/issues) en el repositorio. # desayunos
