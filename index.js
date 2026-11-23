const express = require('express');
const app = express();
app.use(express.json());

const LIBROS_URL = process.env.LIBROS_URL || 'https://libros-service-hess.onrender.com';
const RESENAS_URL = process.env.RESENAS_URL || 'https://resenas-service-zvrb.onrender.com';

// G1: Descubrir las rutas del gateway
app.get('/', (req, res) => {
  res.json({
    servicio: 'api-gateway',
    rutas: [
      'GET /',
      'GET /api/estado',
      'GET /api/libros',
      'GET /api/resenas',
      'GET /api/libros/:id/detalle'
    ]
  });
});

// G2: Estado de los microservicios
app.get('/api/estado', async (req, res) => {
  const check = async (url) => {
    try {
      const r = await fetch(`${url}/libros`);
      return r.ok ? 'UP' : 'DOWN';
    } catch {
      return 'DOWN';
    }
  };
  const checkResenas = async (url) => {
    try {
      const r = await fetch(`${url}/resenas`);
      return r.ok ? 'UP' : 'DOWN';
    } catch {
      return 'DOWN';
    }
  };

  const [librosStatus, resenasStatus] = await Promise.all([
    check(LIBROS_URL),
    checkResenas(RESENAS_URL)
  ]);

  res.json({
    servicios: {
      'libros-service': { status: librosStatus },
      'resenas-service': { status: resenasStatus }
    }
  });
});

// G3: Enrutar hacia libros
app.get('/api/libros', async (req, res) => {
  try {
    const r = await fetch(`${LIBROS_URL}/libros`);
    const data = await r.json();
    res.set('x-upstream', 'libros-service');
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Error conectando con libros-service' });
  }
});

// G4: Enrutar hacia reseñas
app.get('/api/resenas', async (req, res) => {
  try {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const r = await fetch(`${RESENAS_URL}/resenas${query}`);
    const data = await r.json();
    res.set('x-upstream', 'resenas-service');
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Error conectando con resenas-service' });
  }
});

// G5: Agregar libro + reseñas
app.get('/api/libros/:id/detalle', async (req, res) => {
  const { id } = req.params;
  try {
    const libroRes = await fetch(`${LIBROS_URL}/libros/${id}`);
    const libro = await libroRes.json();

    let resenas = [];
    let degradado = false;
    try {
      const resenasRes = await fetch(`${RESENAS_URL}/resenas?libroId=${id}`);
      if (resenasRes.ok) {
        resenas = await resenasRes.json();
      } else {
        degradado = true;
      }
    } catch {
      degradado = true;
    }

    const promedio = resenas.length > 0
      ? Number((resenas.reduce((acc, item) => acc + (item.calificacion || item.puntuacion || 0), 0) / resenas.length).toFixed(2))
      : 0;

    res.json({
      libro,
      resenas,
      degradado,
      promedio
    });
  } catch (err) {
    res.status(502).json({ error: 'Error obteniendo detalle del libro' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gateway escuchando en puerto ${PORT}`));