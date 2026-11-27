export const HELP_CATEGORIES = [
  { id: 'todos', label: 'Todos los módulos', color: 'indigo' },
  { id: 'facturacion', label: 'Facturación CFDI 4.0', color: 'blue' },
  { id: 'cobranza', label: 'Pagos y Cobranza', color: 'emerald' },
  { id: 'comercial', label: 'Comercial y Operaciones', color: 'amber' },
  { id: 'catalogos', label: 'Catálogos SAT y Flota', color: 'purple' },
  { id: 'administracion', label: 'Configuración y Cuenta', color: 'slate' }
];

export const HELP_GUIDES = [
  {
    id: 'dashboard',
    category: 'facturacion',
    routes: ['/'],
    primaryRoute: '/',
    actionLabel: 'Ir al Dashboard',
    module: 'Dashboard',
    title: 'Panel Principal y Monitoreo en Tiempo Real',
    duration: '1 min',
    summary: 'Resumen de tus CFDI emitidos, ingresos del periodo, alertas de suscripción, folios disponibles y accesos rápidos.',
    videoUrl: '/help/videos/dashboard.mp4',
    steps: [
      {
        title: '1. Verifica tu Emisor Activo',
        detail: 'En la barra superior derecha selecciona la Empresa (si eres Administrador) y el Emisor (RFC) con el que vas a trabajar antes de emitir cualquier documento.',
        tip: 'Todos los catálogos, folios y facturas se filtran automáticamente según el Emisor seleccionado arriba.'
      },
      {
        title: '2. Revisa alertas de suscripción y folios',
        detail: 'En la parte superior verás avisos preventivos si tu plan está a 5 días o menos de vencer, o si tus timbres están por agotarse.'
      },
      {
        title: '3. Analiza indicadores y usa accesos rápidos',
        detail: 'Consulta el monto facturado del mes, facturas timbradas vs. canceladas y haz clic en las tarjetas para saltar directo a Nueva Factura, Documentos o Pagos.'
      }
    ],
    commonErrors: [
      {
        code: 'Sin Emisores en barra superior',
        cause: 'El espacio de trabajo recién creado aún no tiene un RFC Emisor dado de alta.',
        solution: 'Haz clic en el botón amarillo "+ Registrar" en la barra superior o ve al módulo Emisores para dar de alta tu RFC y certificados CSD.'
      }
    ],
    example: {
      title: 'Checklist antes de empezar a facturar',
      items: [
        { label: 'Emisor activo', value: 'Verifica RFC y Razón Social en la barra superior' },
        { label: 'Certificado CSD vigente', value: 'Archivos .cer y .key cargados en el módulo Emisores' },
        { label: 'Suscripción activa', value: 'Días vigentes y timbres disponibles en Mi Suscripción' }
      ]
    }
  },
  {
    id: 'nueva-factura',
    category: 'facturacion',
    routes: ['/facturas/nueva'],
    primaryRoute: '/facturas/nueva',
    actionLabel: 'Emitir Nueva Factura',
    module: 'Nueva Factura CFDI 4.0',
    title: 'Cómo emitir y timbrar una Factura CFDI 4.0',
    duration: '3 min',
    summary: 'Flujo completo paso a paso: selección de receptor, método/forma de pago, conceptos, impuestos federales/locales y timbrado ante el SAT.',
    videoUrl: '/help/videos/nueva-factura.mp4',
    steps: [
      {
        title: '1. Selecciona el Receptor (Cliente)',
        detail: 'Elige un cliente registrado o créalo al vuelo. En CFDI 4.0 el RFC, Nombre/Razón Social (en mayúsculas y sin régimen societario como S.A. de C.V.), Código Postal y Régimen Fiscal deben coincidir exactamente con su Constancia de Situación Fiscal.'
      },
      {
        title: '2. Define Uso de CFDI, Método y Forma de Pago',
        detail: 'Si el cliente ya pagó o paga de contado en el momento, elige Método "PUE" + la forma real (01 Efectivo, 03 Transferencia, 04 Tarjeta, 28 Débito). Si pagará después o a crédito, elige Método "PPD" + Forma "99 Por definir".',
        tip: 'Regla de oro del SAT: Si eliges PPD, la Forma de Pago DEBE ser 99 (Por definir). Si eliges PUE, NUNCA uses 99.'
      },
      {
        title: '3. Agrega Conceptos e Impuestos',
        detail: 'Busca productos de tu catálogo o agrégalos manualmente indicando ClaveProdServ (8 dígitos), ClaveUnidad (ej. H87 Pieza, E48 Servicio), Objeto de Impuesto (02 Sí objeto) y sus tasas de IVA, Retenciones o Impuestos Locales.'
      },
      {
        title: '4. Relaciona CFDI (solo si sustituye otra factura)',
        detail: 'Si estás reexpidiendo una factura que vas a cancelar con Motivo 01, abre la sección "CFDI Relacionados", elige Tipo de Relación "04 - Sustitución de los CFDI previos" y selecciona el UUID anterior.'
      },
      {
        title: '5. Revisa totales y Timbra',
        detail: 'Verifica Subtotal, Descuentos, Impuestos Trasladados/Retenidos y Total. Haz clic en "Timbrar CFDI" para obtener al instante el XML oficial sellado y el PDF con código QR.'
      }
    ],
    commonErrors: [
      {
        code: 'CFDI40138 / El nombre del receptor no coincide',
        cause: 'El nombre capturado incluye "SA DE CV" o tiene algún acento/espacio distinto a la Constancia del SAT.',
        solution: 'Edita el Receptor y copia el nombre tal cual aparece en su Constancia de Situación Fiscal, en mayúsculas y sin régimen societario.'
      },
      {
        code: 'CFDI40147 / El Código Postal del receptor no corresponde',
        cause: 'El CP capturado no es el domicilio fiscal registrado ante el SAT para ese RFC.',
        solution: 'Verifica la Constancia de Situación Fiscal actualizada del cliente (o usa CP del Emisor únicamente si el RFC es genérico XAXX010101000 con uso S01).'
      },
      {
        code: 'CFDI40161 / Uso de CFDI no válido para el Régimen',
        cause: 'El Uso de CFDI seleccionado (ej. D01 Honorarios médicos) no aplica para Personas Morales (ej. 601).',
        solution: 'Para gastos operativos habituales usa G03 (Gastos en general) o G01 (Adquisición de mercancías). Para público en general usa S01.'
      }
    ],
    example: {
      title: 'Regla rápida: PUE vs PPD',
      items: [
        { label: 'Pago de contado (hoy)', value: 'Método: PUE · Forma: 01 Efectivo / 03 Transferencia / 04 Tarjeta' },
        { label: 'Crédito / Pago posterior', value: 'Método: PPD · Forma: 99 (Por definir)' },
        { label: 'Cuando el cliente pague la PPD', value: 'Ve a Cuentas por Cobrar (/pagos) y emite un Complemento de Pago (REP)' }
      ]
    }
  },
  {
    id: 'documentos',
    category: 'facturacion',
    routes: ['/documentos'],
    primaryRoute: '/documentos',
    actionLabel: 'Ver Documentos Emitidos',
    module: 'Documentos Emitidos',
    title: 'Consultar, descargar, enviar por correo y cancelar CFDI',
    duration: '2 min',
    summary: 'Administra todas tus facturas timbradas: descarga XML/PDF, reenvía comprobantes por email, consulta acuses SAT o solicita cancelaciones.',
    videoUrl: '/help/videos/documentos.mp4',
    steps: [
      {
        title: '1. Filtra por fecha, folio, UUID o cliente',
        detail: 'Usa el buscador rápido y los filtros de estatus (Timbrado, Cancelado, Pendiente de aceptación) para encontrar cualquier comprobante en segundos.'
      },
      {
        title: '2. Descarga XML / PDF o envía por correo',
        detail: 'En la columna de acciones de cada factura puedes visualizar o descargar el PDF con tu logotipo, bajar el XML timbrado o enviarlo por correo electrónico al cliente.'
      },
      {
        title: '3. Cancela con el Motivo SAT oficial (01 al 04)',
        detail: 'Al presionar "Cancelar CFDI" elige el motivo del SAT. Si seleccionas "01 - Comprobante emitido con errores con relación", primero debes haber timbrado la nueva factura para indicar su UUID sustituto.',
        tip: 'El motivo más sencillo cuando aún puedes cancelar directamente es el "02 - Comprobante emitido con errores sin relación".'
      },
      {
        title: '4. Consulta el Acuse de Cancelación',
        detail: 'Una vez cancelado el documento, puedes abrir y descargar el Acuse oficial del SAT desde el botón de estado de cancelación.'
      }
    ],
    commonErrors: [
      {
        code: 'No se puede cancelar: Tiene documentos relacionados vigentes',
        cause: 'La factura tiene un Complemento de Pago (REP) activo o está relacionada en otra factura vigente.',
        solution: 'Primero debes cancelar el Complemento de Pago asociado en el módulo Cuentas por Cobrar (/pagos) y luego cancelar la factura.'
      },
      {
        code: 'En espera de aceptación del receptor (Plazo 72 hrs)',
        cause: 'Facturas mayores a $1,000 MXN después de 24 horas de emitidas requieren que el cliente acepte la cancelación en su Buzón Tributario.',
        solution: 'Pide a tu cliente que acepte la solicitud en el SAT, o espera 72 horas hábiles: si el cliente no responde, el SAT la cancela por plazo vencido.'
      }
    ],
    example: {
      title: 'Los 4 Motivos de Cancelación del SAT',
      items: [
        { label: 'Motivo 01 (Con relación)', value: 'Emitiste primero la factura nueva que sustituye a esta y tienes su UUID a la mano.' },
        { label: 'Motivo 02 (Sin relación)', value: 'Tenía errores y la cancelas directamente sin amarrar un UUID sustituto en el acto.' },
        { label: 'Motivo 03 (No se realizó)', value: 'La venta o servicio finalmente se canceló y no se llevará a cabo.' },
        { label: 'Motivo 04 (Factura global)', value: 'Un cliente de venta al público en general te pidió su factura individual nominativa.' }
      ]
    }
  },
  {
    id: 'pagos',
    category: 'cobranza',
    routes: ['/pagos'],
    primaryRoute: '/pagos',
    actionLabel: 'Ir a Cuentas por Cobrar (REP)',
    module: 'Cuentas por Cobrar / REP 2.0',
    title: 'Emitir Complementos de Recepción de Pagos (REP 2.0)',
    duration: '3 min',
    summary: 'Lleva el control de cartera de tus facturas a crédito (PPD), registra abonos parciales o liquidaciones y timbra el CFDI tipo P.',
    videoUrl: '/help/videos/pagos.mp4',
    steps: [
      {
        title: '1. Localiza la factura PPD con saldo pendiente',
        detail: 'En Cuentas por Cobrar verás todas las facturas emitidas con método PPD, su monto total, cuánto han abonado y el Saldo Insoluto pendiente.'
      },
      {
        title: '2. Haz clic en Registrar Pago / Emitir REP',
        detail: 'Ingresa la Fecha de Pago real (cuando el dinero entró a tu banco), la Forma de Pago real (ej. 03 Transferencia electrónica) y el monto depositado.'
      },
      {
        title: '3. Verifica Número de Parcialidad y Saldos',
        detail: 'El sistema calcula automáticamente el Número de Parcialidad (1, 2, 3...), el Saldo Anterior, el Importe Pagado, el Nuevo Saldo Insoluto y desglosa proporcionalmente los impuestos (IVA) del pago.',
        tip: 'Tienes hasta el día 5 natural del mes siguiente al que recibiste el pago para timbrar el Complemento de Pago (REP).'
      },
      {
        title: '4. Timbra y envía el Complemento al cliente',
        detail: 'Al confirmar, se genera un CFDI tipo "P" con Uso CP01 (Pagos). Puedes descargar su XML y PDF o enviarlo por correo.'
      }
    ],
    commonErrors: [
      {
        code: 'La factura no aparece para aplicarle un pago',
        cause: 'La factura original fue emitida con método PUE (Pago en una sola exhibición) en lugar de PPD.',
        solution: 'Las facturas PUE ya se consideran pagadas fiscalmente ante el SAT. Solo las facturas PPD generan Complemento de Pago.'
      }
    ],
    example: {
      title: 'Ejemplo práctico: Factura PPD de $10,000 MXN en 2 pagos',
      items: [
        { label: 'Pago 1 ($4,000)', value: 'Parcialidad: 1 · Saldo Ant: $10,000 · Pagado: $4,000 · Saldo Insoluto: $6,000' },
        { label: 'Pago 2 ($6,000)', value: 'Parcialidad: 2 · Saldo Ant: $6,000 · Pagado: $6,000 · Saldo Insoluto: $0.00 (Liquidada)' }
      ]
    }
  },
  {
    id: 'cuentas-por-pagar',
    category: 'cobranza',
    routes: ['/cuentas-por-pagar'],
    primaryRoute: '/cuentas-por-pagar',
    actionLabel: 'Ir a Cuentas por Pagar',
    module: 'Cuentas por Pagar',
    title: 'Control de XML Recibidos, Gastos y Pago a Proveedores',
    duration: '2 min',
    summary: 'Importa los archivos XML de tus proveedores, audita vencimientos y registra tus pagos realizados para llevar tus egresos al día.',
    videoUrl: '/help/videos/cuentas-por-pagar.mp4',
    steps: [
      {
        title: '1. Importa el archivo XML de tu proveedor',
        detail: 'Sube uno o varios XML recibidos. El sistema lee automáticamente RFC emisor, razón social, UUID, fecha, impuestos y total.'
      },
      {
        title: '2. Monitorea estatus y fechas de vencimiento',
        detail: 'Filtra tus cuentas por pagar pendientes, próximas a vencer, vencidas o pagadas para planificar tu flujo de efectivo.'
      },
      {
        title: '3. Registra abonos o liquidación al proveedor',
        detail: 'Cuando realices la transferencia a tu proveedor, registra el pago con su referencia bancaria para actualizar el saldo pendiente.'
      }
    ],
    example: {
      title: 'Ventajas de cargar tus XML de gastos',
      items: [
        { label: 'Cero captura manual', value: 'El lector XML extrae UUID, montos e impuestos sin errores de dedo' },
        { label: 'Evita pagos duplicados', value: 'El sistema valida que el UUID del proveedor no haya sido registrado antes' }
      ]
    }
  },
  {
    id: 'recurrentes',
    category: 'comercial',
    routes: ['/recurrentes'],
    primaryRoute: '/recurrentes',
    actionLabel: 'Ir a Facturación Recurrente',
    module: 'Facturación Recurrente',
    title: 'Automatiza Rentas, Igualas y Cobros Periódicos',
    duration: '2 min',
    summary: 'Programa plantillas de facturas que se emiten periódicamente (mensual, quincenal, semanal) para clientes con cobros fijos.',
    videoUrl: '/help/videos/administracion.mp4',
    steps: [
      {
        title: '1. Crea una plantilla recurrente',
        detail: 'Selecciona el receptor, uso de CFDI, método/forma de pago y los conceptos fijos (ej. Renta mensual, Iguala de soporte o Mantenimiento).'
      },
      {
        title: '2. Define frecuencia y próxima fecha de ejecución',
        detail: 'Elige cada cuánto se debe emitir (semanal, quincenal, mensual, anual) y la fecha del próximo corte.'
      },
      {
        title: '3. Ejecuta o pausa cuando lo necesites',
        detail: 'Puedes disparar la emisión con un solo clic en la fecha de corte o pausar/reactivar suscripciones de tus clientes.'
      }
    ],
    example: {
      title: 'Casos ideales para Facturación Recurrente',
      items: [
        { label: 'Arrendamiento', value: 'Cobro de renta de locales u oficinas el día 1 de cada mes' },
        { label: 'Servicios / Igualas', value: 'Pólizas de soporte técnico, contabilidad o licencias mensuales' }
      ]
    }
  },
  {
    id: 'cotizaciones-ordenes',
    category: 'comercial',
    routes: ['/cotizaciones', '/cotizaciones/nueva', '/ordenes-servicio', '/ordenes-servicio/nueva'],
    primaryRoute: '/cotizaciones',
    actionLabel: 'Ir a Cotizaciones',
    module: 'Cotizaciones y Órdenes de Servicio',
    title: 'Del Presupuesto Comercial a la Factura en 1 Clic',
    duration: '2 min',
    summary: 'Elabora cotizaciones formales y órdenes de trabajo para tus clientes y conviértelas en Factura CFDI 4.0 sin recapturar datos.',
    videoUrl: '/help/videos/administracion.mp4',
    steps: [
      {
        title: '1. Crea una Cotización u Orden de Servicio',
        detail: 'Selecciona al cliente, agrega las partidas, precios, descuentos, vigencia o notas técnicas del servicio.'
      },
      {
        title: '2. Envía el PDF al cliente y actualiza el estatus',
        detail: 'Descarga o comparte el documento en PDF y marca la cotización como Aprobada cuando el cliente confirme.'
      },
      {
        title: '3. Convierte a Factura CFDI 4.0',
        detail: 'Usa la acción "Convertir a Factura": el sistema cargará automáticamente al cliente, conceptos e impuestos en el facturador listo para timbrar.'
      }
    ]
  },
  {
    id: 'reportes',
    category: 'comercial',
    routes: ['/reportes'],
    primaryRoute: '/reportes',
    actionLabel: 'Abrir Reportes',
    module: 'Reportes e Indicadores',
    title: 'Reportes Fiscales, Ventas e Impuestos para Contabilidad',
    duration: '2 min',
    summary: 'Consulta resúmenes por periodo, desglose de IVA trasladado/retenido, ventas por cliente y exporta información para tu contador.',
    videoUrl: '/help/videos/administracion.mp4',
    steps: [
      {
        title: '1. Selecciona el rango de fechas',
        detail: 'Filtra por mes actual, mes anterior o un rango personalizado para cuadrar tu cierre mensual.'
      },
      {
        title: '2. Revisa impuestos y facturación neta',
        detail: 'Analiza el subtotal facturado, IVA trasladado, retenciones de ISR/IVA y el volumen por cliente o estatus.'
      },
      {
        title: '3. Exporta tu listado',
        detail: 'Descarga el concentrado para entregarlo a tu despacho contable o conciliar contra tus estados de cuenta bancarios.'
      }
    ]
  },
  {
    id: 'carta-porte',
    category: 'catalogos',
    routes: ['/carta-porte/nueva', '/vehiculos', '/choferes'],
    primaryRoute: '/carta-porte/nueva',
    actionLabel: 'Abrir Asistente Carta Porte',
    module: 'Carta Porte 3.1 y Flota',
    title: 'Generar Complemento Carta Porte 3.1 Paso a Paso',
    duration: '4 min',
    summary: 'Asistente guiado para emitir CFDI de Ingreso o Traslado con Complemento Carta Porte 3.1, catálogo de vehículos y operadores.',
    videoUrl: '/help/videos/carta-porte.mp4',
    steps: [
      {
        title: '1. Registra tu Flota (Vehículos) y Choferes',
        detail: 'En los menús "Vehículos Flota" y "Choferes" da de alta tus unidades (Placas, Año, Config. Vehicular SAT, Permiso SCT y Póliza de Seguro) y tus operadores (RFC y Número de Licencia).'
      },
      {
        title: '2. Elige el Tipo de CFDI (Ingreso vs. Traslado)',
        detail: 'Si eres transportista y cobras un flete a un cliente, usa CFDI de Ingreso (I). Si transportas tu propia mercancía con tus propios camiones sin cobrar flete, usa CFDI de Traslado (T) con subtotal $0.',
        tip: 'En un CFDI de Traslado propio, el receptor suele ser el mismo emisor y los importes van en cero.'
      },
      {
        title: '3. Define Ubicaciones (Origen y Destino)',
        detail: 'Captura Código Postal, Estado, Municipio, Fecha/Hora de salida y llegada estimada, y la Distancia Recorrida en kilómetros.'
      },
      {
        title: '4. Captura Mercancías y Autotransporte',
        detail: 'Agrega cada bien transportado con su Clave SAT, cantidad, clave de unidad, peso en kilogramos y selecciona el vehículo y chofer asignados.'
      }
    ],
    commonErrors: [
      {
        code: 'Error de validación en Código Postal / Municipio de Ubicación',
        cause: 'El municipio o estado no coincide con el catálogo de códigos postales del SAT para Carta Porte.',
        solution: 'Al escribir los 5 dígitos del CP en Origen o Destino, deja que el sistema autocomplete Estado, Municipio y Localidad.'
      }
    ],
    example: {
      title: '¿Cuándo usar CFDI de Ingreso vs. Traslado en Carta Porte?',
      items: [
        { label: 'CFDI Tipo Ingreso (I)', value: 'Te contrataron para mover mercancía de un cliente y cobras el servicio de flete (lleva precio, IVA y retención 4%).' },
        { label: 'CFDI Tipo Traslado (T)', value: 'Mueves tus propias mercancías con tus propios vehículos entre bodegas o hacia tu cliente (total $0.00).' }
      ]
    }
  },
  {
    id: 'emisores',
    category: 'administracion',
    routes: ['/emisores'],
    primaryRoute: '/emisores',
    actionLabel: 'Configurar Emisores y CSD',
    module: 'Emisores y CSD',
    title: 'Alta de RFC Emisor y Carga de Sellos Digitales (CSD)',
    duration: '2 min',
    summary: 'Configura la razón social emisora, régimen fiscal, series de facturación y sube tus archivos .cer y .key del CSD para poder timbrar.',
    videoUrl: '/help/videos/emisores.mp4',
    steps: [
      {
        title: '1. Captura los datos fiscales del Emisor',
        detail: 'Ingresa el RFC, Razón Social (sin régimen societario), Régimen Fiscal del SAT y el Código Postal de expedición (lugar donde se emiten las facturas).'
      },
      {
        title: '2. Sube el Certificado de Sello Digital (CSD)',
        detail: 'Selecciona el archivo .cer (certificado), el archivo .key (llave privada) y escribe la contraseña privada del CSD.',
        tip: 'Importante: Para facturar debes subir los archivos del CSD (Sello Digital), NO los de la e.firma (FIEL).'
      },
      {
        title: '3. Configura Serie y Folio consecutivo',
        detail: 'Define la serie (ej. A, F, FAC) y el folio inicial para que tus comprobantes sigan la numeración de tu negocio.'
      }
    ],
    commonErrors: [
      {
        code: 'El certificado no corresponde a un CSD o es una FIEL',
        cause: 'Se cargaron los archivos .cer y .key de la e.firma (FIEL) en lugar del Certificado de Sello Digital.',
        solution: 'Tramitá o descarga tu Certificado de Sello Digital (CSD) desde CertiSAT Web y sube esos archivos .cer y .key.'
      },
      {
        code: 'Contraseña de llave privada incorrecta',
        cause: 'La contraseña escrita no desencripta el archivo .key cargado.',
        solution: 'Verifica mayúsculas y minúsculas de la contraseña del CSD que definiste al generarlo en la aplicación Certifica del SAT.'
      }
    ],
    example: {
      title: 'Diferencia entre e.firma (FIEL) y CSD',
      items: [
        { label: 'e.firma (FIEL)', value: 'Sirve para entrar al portal del SAT y firmar trámites; NO sirve para timbrar facturas (en Personas Morales).' },
        { label: 'CSD (Sello Digital)', value: 'Se genera usando la e.firma y es el único certificado válido para sellar y timbrar CFDI 4.0.' }
      ]
    }
  },
  {
    id: 'receptores',
    category: 'catalogos',
    routes: ['/receptores'],
    primaryRoute: '/receptores',
    actionLabel: 'Administrar Receptores',
    module: 'Receptores (Clientes)',
    title: 'Catálogo de Clientes y Reglas de Validación CFDI 4.0',
    duration: '2 min',
    summary: 'Registra a tus clientes con los 4 datos obligatorios que valida el PAC y el SAT en CFDI 4.0 para evitar rechazos.',
    videoUrl: '/help/videos/receptores.mp4',
    steps: [
      {
        title: '1. Pide la Constancia de Situación Fiscal del cliente',
        detail: 'Para evitar errores de timbrado, ten a la vista la Constancia del cliente (o su Cédula de Datos Fiscales).'
      },
      {
        title: '2. Captura RFC y Nombre en MAYÚSCULAS sin régimen societario',
        detail: 'Si la constancia dice "COMERCIALIZADORA DEL NORTE, S.A. DE C.V.", debes capturar únicamente "COMERCIALIZADORA DEL NORTE".'
      },
      {
        title: '3. Captura Código Postal fiscal y Régimen Fiscal',
        detail: 'Ingresa los 5 dígitos del CP que viene en la constancia y elige su Régimen Fiscal exacto (ej. 601, 612, 626).'
      },
      {
        title: '4. Define correo electrónico y Uso de CFDI predeterminado',
        detail: 'Agrega el email del cliente para enviarle sus facturas en 1 clic y deja preconfigurado su Uso de CFDI más frecuente (ej. G03).'
      }
    ],
    example: {
      title: '¿Cómo facturar a Público en General o Extranjeros?',
      items: [
        { label: 'Público en General (Nacional)', value: 'RFC: XAXX010101000 · Nombre: PUBLICO EN GENERAL · Régimen: 616 · Uso: S01 · CP: El mismo CP de tu Emisor' },
        { label: 'Cliente Extranjero', value: 'RFC: XEXX010101000 · Régimen: 616 · Uso: S01 · CP: El mismo CP de tu Emisor' }
      ]
    }
  },
  {
    id: 'conceptos-impuestos',
    category: 'catalogos',
    routes: ['/conceptos', '/impuestos', '/impuestos-locales'],
    primaryRoute: '/conceptos',
    actionLabel: 'Ir a Catálogo de Conceptos',
    module: 'Conceptos e Impuestos',
    title: 'Catálogo de Productos, Claves SAT e Impuestos',
    duration: '2 min',
    summary: 'Preconfigura tus productos y servicios con su ClaveProdServ, ClaveUnidad, Objeto de Impuesto, IVA, Retenciones e Impuestos Locales.',
    videoUrl: '/help/videos/conceptos.mp4',
    steps: [
      {
        title: '1. Busca la ClaveProdServ y ClaveUnidad del SAT',
        detail: 'En el módulo Conceptos usa el buscador inteligente del catálogo SAT para elegir la clave de 8 dígitos y su unidad de medida (ej. E48 Unidad de servicio, H87 Pieza, ACT Actividad).'
      },
      {
        title: '2. Configura el Objeto de Impuesto',
        detail: 'Usa "02 - Sí objeto de impuesto" cuando el concepto lleve IVA (16%, 8% o 0%). Usa "01 - No objeto de impuesto" solo para operaciones no gravadas.'
      },
      {
        title: '3. Tasas de Impuestos Federales y Locales',
        detail: 'En el módulo Impuestos administra tus esquemas de IVA e ISR/IVA retenido (ej. RESICO 1.25%). En Impuestos Locales configura ISH (Hospedaje), Cedular o 5 al millar.'
      }
    ],
    example: {
      title: 'Claves de Unidad SAT más utilizadas',
      items: [
        { label: 'H87 - Pieza', value: 'Para venta de productos físicos, artículos o mercancías por unidad' },
        { label: 'E48 - Unidad de servicio', value: 'Para honorarios, consultoría, mantenimiento o servicios profesionales' },
        { label: 'ACT - Actividad', value: 'Para facturas globales o cobros por evento/proyecto' }
      ]
    }
  },
  {
    id: 'comercial-diseno-config',
    category: 'administracion',
    routes: ['/configuracion/diseno', '/configuracion', '/usuarios', '/mi-suscripcion'],
    primaryRoute: '/configuracion/diseno',
    actionLabel: 'Ir a Diseño y Configuración',
    module: 'Diseño PDF, Usuarios y Suscripción',
    title: 'Personalizar Factura PDF, Roles de Usuario y Suscripción',
    duration: '2 min',
    summary: 'Adapta el diseño visual de tus facturas PDF con tu logotipo y colores, gestiona permisos de tu equipo y consulta tu plan de timbrado.',
    videoUrl: '/help/videos/administracion.mp4',
    steps: [
      {
        title: '1. Personaliza tu PDF en el Diseñador de Facturas',
        detail: 'Sube el logotipo de tu empresa: el sistema extraerá tu paleta de colores automáticamente o podrás elegir tu color corporativo, plantilla y leyenda al pie.'
      },
      {
        title: '2. Crea Usuarios y asigna Roles',
        detail: 'En el módulo Usuarios invita a tu equipo con rol de Facturación / Operador o Usuario Empresarial para que trabajen únicamente en su empresa asignada.'
      },
      {
        title: '3. Revisa tu Plan en Mi Suscripción',
        detail: 'Consulta cuántos días restantes tiene tu periodo, timbres consumidos y datos para renovar tu suscripción sin interrupciones.'
      }
    ]
  }
];

export const HELP_FAQS = [
  {
    id: 'faq-nombre-40',
    category: 'facturacion',
    question: '¿Cómo debo escribir el nombre o razón social del cliente en CFDI 4.0?',
    answer: 'Debes escribirlo en MAYÚSCULAS y exactamente como aparece en su Constancia de Situación Fiscal, omitiendo el régimen societario (es decir, NO pongas ", S.A. DE C.V.", "S. DE R.L. DE C.V.", "S.C.", etc.). Respeta acentos, puntos o signos si así aparecen en la sección de Nombre/Denominación o Razón Social de la constancia.'
  },
  {
    id: 'faq-pue-ppd',
    category: 'facturacion',
    question: '¿Cuándo debo elegir PUE y cuándo PPD?',
    answer: 'Elige PUE (Pago en una sola exhibición) cuando el cliente ya te pagó antes de emitir la factura o te está pagando de contado en ese momento (debes indicar cómo pagó: 03 Transferencia, 01 Efectivo, 04 Tarjeta, etc.). Elige PPD (Pago en parcialidades o diferido) cuando vendas a crédito o te vayan a pagar después; con PPD la Forma de Pago siempre debe ser "99 - Por definir", y cuando recibas el dinero deberás emitir un Complemento de Pago (REP).'
  },
  {
    id: 'faq-publico-general',
    category: 'facturacion',
    question: '¿Qué datos se usan para facturar a Público en General (Factura Global)?',
    answer: 'Crea o selecciona un receptor con: RFC "XAXX010101000", Nombre "PUBLICO EN GENERAL", Régimen Fiscal "616 - Sin obligaciones fiscales", Uso de CFDI "S01 - Sin efectos fiscales" y como Código Postal debes poner exactamente el mismo Código Postal de tu Emisor (lugar de expedición).'
  },
  {
    id: 'faq-cancelacion-01-02',
    category: 'facturacion',
    question: '¿Cuál es la diferencia entre cancelar con Motivo 01 y Motivo 02?',
    answer: 'El Motivo 01 (Con relación) te exige que PRIMERO emitas la nueva factura corregida (relacionando la anterior con tipo 04) y pegues el nuevo UUID al momento de cancelar la factura vieja. El Motivo 02 (Sin relación) te permite cancelar la factura errónea directamente sin pedirte un UUID sustituto en ese instante.'
  },
  {
    id: 'faq-plazo-rep',
    category: 'cobranza',
    question: '¿Cuál es la fecha límite para emitir un Complemento de Pago (REP 2.0)?',
    answer: 'De acuerdo con el SAT, tienes hasta el quinto día natural del mes inmediato siguiente al mes en que recibiste el pago. Por ejemplo, si el cliente te depositó el 18 de mayo, puedes timbrar el REP a más tardar el 5 de junio (indicando como Fecha de Pago el 18 de mayo).'
  },
  {
    id: 'faq-csd-fiel',
    category: 'administracion',
    question: '¿Por qué me marca error al subir mis archivos .cer y .key?',
    answer: 'La causa número uno es subir los archivos de la e.firma (FIEL) en lugar de los del Certificado de Sello Digital (CSD). Verifica que estés cargando tu CSD vigente y que la contraseña corresponda a la llave privada (.key) del CSD.'
  },
  {
    id: 'faq-retencion-resico',
    category: 'catalogos',
    question: 'Soy Persona Física en RESICO (Régimen 626) y le facturo a una Persona Moral, ¿qué retención lleva?',
    answer: 'Cuando una Persona Física del Régimen Simplificado de Confianza (626) le factura a una Persona Moral, el concepto debe incluir una Retención de ISR del 1.25% sobre el subtotal, además del IVA trasladado que corresponda.'
  },
  {
    id: 'faq-carta-porte-cuando',
    category: 'catalogos',
    question: '¿Cuándo es obligatorio agregar el Complemento Carta Porte 3.1?',
    answer: 'Es obligatorio cuando se trasladan bienes o mercancías por tramos de jurisdicción federal. Si eres transportista que cobra el flete, emites un CFDI de Ingreso con Carta Porte. Si trasladas tus propias mercancías con tus propios medios en carretera federal, emites un CFDI de Traslado ($0.00) con Carta Porte.'
  }
];
