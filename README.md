# Estética Agus — Sistema de Reservas Web

Sistema web de reservas para un centro de estética y bienestar, desarrollado con HTML/CSS/JS puro y Firebase.

## Funcionalidades

- **Autenticación**: registro, login, recuperación de contraseña (Firebase Auth)
- **Reservas**: crear, ver, editar y cancelar turnos
- **Servicios**: catálogo completo de tratamientos faciales, corporales y capilares
- **Panel de usuario**: dashboard con próximas reservas y datos personales
- **Panel admin**: gestión de reservas, servicios y configuración de disponibilidad
- **Buscador de tratamientos**: búsqueda por nombre y filtro por categoría
- **Responsive**: diseño adaptado a celular y PC

## Tecnologías

- HTML5, CSS3, JavaScript (vanilla)
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting (opcional)

## Estructura del proyecto

```
EsteticaAgus/
├── public/                   # Archivos del sitio web
│   ├── index.html            # Home
│   ├── login.html            # Inicio de sesión
│   ├── register.html         # Registro
│   ├── dashboard.html        # Panel del usuario
│   ├── nueva-reserva.html    # Crear reserva
│   ├── mis-reservas.html     # Listar reservas propias
│   ├── editar-reserva.html   # Editar reserva existente
│   ├── tratamientos.html     # Info y búsqueda de tratamientos
│   ├── admin.html            # Panel de administración
│   ├── css/
│   │   └── styles.css        # Estilos globales
│   ├── js/
│   │   ├── firebase-config.js  # Configuración de Firebase
│   │   ├── auth.js             # Lógica de autenticación
│   │   ├── utils.js            # Utilidades compartidas
│   │   ├── reservas.js         # CRUD de reservas
│   │   └── admin.js            # Lógica del panel admin
│   └── img/                  # Imágenes (opcional)
├── firestore.rules           # Reglas de seguridad de Firestore
├── firebase.json             # Configuración de Firebase Hosting
├── .env.example              # Ejemplo de variables de entorno
├── .gitignore
└── README.md
```
