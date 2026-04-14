/**
 * contract-pdf.tsx — PDF document components for FNH contracts.
 *
 * BROWSER-ONLY: this module is dynamically imported from contracts/new/page.tsx
 * inside an event handler. It must never be statically imported at the module level
 * of any Server Component, Server Action, or page file.
 *
 * Four contract types:
 *   tiempo_completo      → ContratoLaboral (título completo)
 *   medio_tiempo         → ContratoLaboral (título parcial)
 *   prestacion_servicios → ContratoPrestacionServicios
 *   otro_si              → OtroSi
 */

import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ContractVars } from './pdf-vars'

// ── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Times-Roman',
    fontSize: 10,
    paddingTop: 80,
    paddingBottom: 70,
    paddingHorizontal: 50,
    lineHeight: 1.4,
  },
  // Fixed header / footer
  header: {
    position: 'absolute',
    top: 10,
    left: 50,
    right: 50,
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    marginBottom: 2,
  },
  headerOrg: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#1a4f8a',
    letterSpacing: 0.3,
  },
  headerNit: {
    fontSize: 7.5,
    color: '#555',
  },
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 50,
    right: 50,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7.5,
    color: '#333',
    textAlign: 'center',
    lineHeight: 1.3,
  },
  // Title block
  titleBlock: {
    marginBottom: 10,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  // Info table
  table: {
    borderTop: '1pt solid #000',
    borderLeft: '1pt solid #000',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #000',
  },
  tableLabel: {
    fontFamily: 'Times-Bold',
    fontSize: 9,
    borderRight: '1pt solid #000',
    paddingHorizontal: 4,
    paddingVertical: 3,
    width: '38%',
  },
  tableValue: {
    fontSize: 9,
    paddingHorizontal: 4,
    paddingVertical: 3,
    flex: 1,
    borderRight: '1pt solid #000',
  },
  tableLabelCentered: {
    fontFamily: 'Times-Bold',
    fontSize: 9,
    borderRight: '1pt solid #000',
    paddingHorizontal: 4,
    paddingVertical: 3,
    width: '38%',
    textAlign: 'center',
  },
  tableValueCentered: {
    fontSize: 9,
    paddingHorizontal: 4,
    paddingVertical: 3,
    flex: 1,
    borderRight: '1pt solid #000',
    textAlign: 'center',
  },
  // Body text
  body: {
    fontSize: 10,
    textAlign: 'justify',
    marginBottom: 6,
    lineHeight: 1.45,
  },
  bold: {
    fontFamily: 'Times-Bold',
  },
  underlineBold: {
    fontFamily: 'Times-Bold',
    textDecoration: 'underline',
  },
  italic: {
    fontFamily: 'Times-Italic',
  },
  // Signature block
  sigRow: {
    flexDirection: 'row',
    marginTop: 40,
    marginBottom: 6,
  },
  sigCol: {
    flex: 1,
  },
  sigLabel: {
    fontFamily: 'Times-Bold',
    fontSize: 10,
    marginBottom: 50,
  },
  sigName: {
    fontSize: 10,
  },
  sigLine: {
    fontSize: 10,
    marginTop: 2,
  },
  // Appendix separator
  separator: {
    borderTop: '1pt solid #000',
    marginVertical: 8,
  },
  sectionTitle: {
    fontFamily: 'Times-Bold',
    fontSize: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  // Data personal form lines
  formLine: {
    borderBottom: '0.5pt solid #000',
    marginTop: 12,
    marginBottom: 2,
  },
  formLabel: {
    fontFamily: 'Times-Bold',
    fontSize: 10,
  },
  // Signature embed placeholder box
  sigBox: {
    border: '0.5pt solid #000',
    height: 60,
    marginTop: 6,
    marginBottom: 2,
  },
  sigBoxLabel: {
    fontSize: 7.5,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
  },
  // Authorisation checkboxes row
  authRow: {
    flexDirection: 'row',
    gap: 30,
    marginTop: 8,
  },
  authOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkbox: {
    border: '0.5pt solid #000',
    width: 10,
    height: 10,
  },
  checkboxChecked: {
    border: '0.5pt solid #000',
    width: 10,
    height: 10,
    backgroundColor: '#000',
  },
  indent: {
    paddingLeft: 20,
    marginBottom: 4,
  },
})

// ── Shared layout components ────────────────────────────────────────────────

const LOGO_URL = '/logo.png'

function PageHeader() {
  return (
    <View style={S.header} fixed>
      <Image src={LOGO_URL} style={S.logo} />
      <Text style={S.headerOrg}>FUNDACIÓN NUEVO HORIZONTE</Text>
      <Text style={S.headerNit}>Nit. 821.003.251 - 4</Text>
    </View>
  )
}

function PageFooter() {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>
        {'Crr de Zanjón Hondo- callejón Bugatel- Villa Blanquita\n'}
        {'Guadalajara de Buga- Valle del Cauca\n'}
        {'CEL: 311_6829816\n'}
        {'ssnuevoh@gmail.com'}
      </Text>
    </View>
  )
}

// ── Info table row ──────────────────────────────────────────────────────────

function TR({ label, value, centered = false }: { label: string; value: string; centered?: boolean }) {
  return (
    <View style={S.tableRow}>
      <Text style={centered ? S.tableLabelCentered : S.tableLabel}>{label}</Text>
      <Text style={centered ? S.tableValueCentered : S.tableValue}>{value}</Text>
    </View>
  )
}

// ── Clause helpers ──────────────────────────────────────────────────────────

function Cl({ title, body }: { title: string; body: string }) {
  return (
    <Text style={S.body}>
      <Text style={S.underlineBold}>{title}</Text>
      {'  '}{body}
    </Text>
  )
}

function Para({ label = 'PARÁGRAFO:', body }: { label?: string; body: string }) {
  return (
    <Text style={S.body}>
      <Text style={S.bold}>{label}</Text>
      {'  '}{body}
    </Text>
  )
}

function B({ children }: { children: string }) {
  return <Text style={S.bold}>{children}</Text>
}

/** Renders the captured signature image, or an empty placeholder box when none. */
function SigSpace({ firma }: { firma?: string }) {
  if (firma) {
    return <Image src={firma} style={{ height: 60, objectFit: 'contain' }} />
  }
  return (
    <>
      <View style={S.sigBox} />
      <Text style={S.sigBoxLabel}>{'— espacio para firma —'}</Text>
    </>
  )
}

// ── Shared appendix content ─────────────────────────────────────────────────

function AppendixAutorizacionImagenes({ v }: { v: ContractVars }) {
  return (
    <>
      <View style={S.separator} />
      <Text style={S.sectionTitle}>
        {'AUTORIZACION PARA LA PUBLICACIÓN DE IMÁGENES SOBRE FOTOGRAFIAS Y\n'}
        {'AUDIOVISUALES (VIDEOS) EN EVENTOS REALIZADOS POR LA FUNDACION NUEVO\n'}
        {'HORIZONTE NIT:821.003.251-4'}
      </Text>
      <Text style={S.body}>
        <Text style={S.bold}>Nombre:  </Text>{v.trabajador_nombre}
      </Text>
      <Text style={S.body}>
        <Text style={S.bold}>Documento de identidad:  </Text>{v.trabajador_cedula}
      </Text>
      <Text style={S.body}>
        {'Por medio del presente documento otorgo Autorización expresa del uso de los derechos de imagen que me reconocen la Constitución, la ley y demás normas y políticas relacionadas a la FUNDACION NUEVO HORIZONTE.\nLa autorización se regirá por las normas legales aplicables y en particular por las siguientes Cláusulas:'}
      </Text>
      <Cl
        title="PRIMERA. - Autorización y objeto."
        body="Mediante el presente instrumento autorizo a la FUNDACION NUEVO HORIZONTE para que haga el uso y tratamiento de mis derechos de imagen para incluirlos sobre fotografías; procedimientos análogos a la fotografía; producciones audiovisuales (Videos); así como de los Derechos de Autor; los Derechos Conexos y en general todos aquellos derechos de propiedad intelectual que tengan que ver con el derecho de imagen realizadas en las diferentes actividades que realiza constantemente la FUNDACION NUEVO HORIZONTE."
      />
      <Cl
        title="SEGUNDA. - Alcance de la autorización."
        body="La presente autorización de uso se otorga para ser utilizada en formato o soporte material en ediciones impresas, y se extiende a la utilización en medio electrónico, óptico, magnético, en redes (Internet), mensajes de datos o similares y en general para cualquier medio o soporte conocido o por conocer en el futuro. La publicación podrá efectuarse de manera directa o a través de un tercero que se designe para tal fin."
      />
      <Cl
        title="TERCERA. - Territorio y exclusividad."
        body="Los derechos aquí autorizados se dan sin limitación geográfica o territorial alguna. De igual forma la autorización de uso aquí establecida no implicará exclusividad, por lo que me reservo el derecho de otorgar autorizaciones de uso similares en los mismos términos en favor de terceros."
      />
      <Cl
        title="CUARTA. - Derechos morales."
        body="La FUNDACION NUEVO HORIZONTE dará cumplimiento a la normatividad vigente sobre los derechos morales de autor, los cuales seguirán radicados en cabeza de su titular."
      />
      <Text style={S.body}>
        {'Para constancia de lo anterior se firma la presente AUTORIZACIÓN a los '}{v.dia_inicio}{' días del mes de '}{v.mes_inicio}{' del año '}{v.anio_inicio}{', en la Ciudad de Guadalajara de Buga-Valle del Cauca.'}
      </Text>
      <Text style={[S.body, S.bold]}>{'Firma:'}</Text>
      <SigSpace firma={v.firma} />
      <Text style={S.body}>{'C.C. N° '}{v.trabajador_cedula}</Text>
    </>
  )
}

function AppendixDatosPersonales({ v }: { v: ContractVars }) {
  return (
    <>
      <View style={S.separator} />
      <Text style={S.sectionTitle}>{'AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES'}</Text>
      <Text style={[S.body, S.italic]}>{'(Ley 1581 de 2012 y Decreto Reglamentario 1377 de 2013)'}</Text>
      <Text style={S.body}>
        {'Declaro que he sido informado por LA FUNDACION NUEVO HORIZONTE NIT:821.003.251-4, como responsable de los datos personales de los cuales soy titular y que, conjunta o separadamente podrá recolectar, usar y tratar mis datos personales conforme a la política de tratamiento de datos personales que la Fundación dispone en las instalaciones de las oficinas de LA FUNDACION NUEVO HORIZONTE, Crr de Zanjón Hondo- callejón Bugatel- Villa Blanquita, Guadalajara de Buga- Valle del Cauca; es de carácter facultativo responder preguntas que versen sobre Datos Sensibles o sobre menores de edad.\nMis derechos como titular de los datos son los previstos en la Constitución y la ley, especialmente el derecho a conocer, actualizar, rectificar y suprimir mi información personal, para cualquier inquietud o información adicional relacionada con el tratamiento de datos personales, puede contactarnos al correo electrónico ssnuevoh@gmail.com.\nLa Fundación garantiza la confidencialidad, libertad, seguridad, veracidad, transparencia, acceso y circulación restringida de mis datos y se reservan el derecho de modificar su Política de Tratamiento de Datos Personales en cualquier momento. Cualquier cambio será informado y publicado oportunamente.\nTeniendo en cuenta lo anterior, autorizo de manera voluntaria, previa, explícita, informada e inequívoca a LA FUNDACION NUEVO HORIZONTE, para tratar mis datos personales de acuerdo con la política de tratamiento de Datos Personales; para fines relacionados con su objeto social y en especial para fines legales, contractuales, comerciales, laborales descritos en la Política de Tratamiento de Datos.\nLa información obtenida para el Tratamiento de mis datos personales la he suministrado de forma voluntaria y es verídica.'}
      </Text>
      <Text style={S.body}>
        <Text style={S.bold}>{'Nombre o Razón Social: '}</Text>
        {v.trabajador_nombre}
      </Text>
      <Text style={S.body}>
        <Text style={S.bold}>{'Identificación: '}</Text>
        {v.trabajador_cedula}
      </Text>
      <Text style={S.body}>
        <Text style={S.bold}>{'Correo Electrónico: '}</Text>
        {v.trabajador_correo}
      </Text>
      <Text style={[S.body, S.bold]}>{'Firma:'}</Text>
      <SigSpace firma={v.firma} />
      <Text style={S.body}>
        <Text style={S.bold}>{'Fecha: '}</Text>
        {v.fecha_inicio_texto}
      </Text>
      <View style={S.authRow}>
        <View style={S.authOption}>
          <View style={S.checkboxChecked} />
          <Text style={S.body}>{'Autorizo'}</Text>
        </View>
        <View style={S.authOption}>
          <View style={S.checkbox} />
          <Text style={S.body}>{'No Autorizo'}</Text>
        </View>
      </View>
    </>
  )
}

function AppendixConfidencialidad({ v }: { v: ContractVars }) {
  return (
    <>
      <View style={S.separator} />
      <Text style={S.sectionTitle}>{'ACUERDO DE CONFIDENCIALIDAD'}</Text>
      <Text style={S.body}>{'Entre los suscritos a saber:'}</Text>
      <Text style={S.body}>
        {'1. De una parte, '}
        <B>{'DORA PATRICIA CARMONA SOTO'}</B>
        {' identificado(a) con C.C. 29.158.068, Representante Legal de la FUNDACION NUEVO HORIZONTE, con NIT. 821.003.251-4, quien en adelante y para efectos del presente acuerdo se denominará '}
        <B>{'PARTE REVELADORA (EMPLEADOR Y/O CONTRATANTE)'}</B>
        {';'}
      </Text>
      <Text style={S.body}>
        {'2. Y, por otra parte, '}{v.trabajador_nombre}{' persona natural, mayor de edad, identificado/a con número de C.C. No. '}{v.trabajador_cedula}{', en adelante y para efectos de este acuerdo se denominará '}
        <B>{'PARTE RECEPTORA (TRABAJADOR Y/O CONTRATISTA)'}</B>
        {','}
      </Text>
      <Text style={S.body}>
        {'3. Quienes de manera conjunta y para efectos del presente acuerdo se entenderán como '}
        <B>{'LAS PARTES'}</B>
        {'.'}
      </Text>
      <Text style={[S.body, S.bold]}>{'CONSIDERANDO'}</Text>
      <Text style={S.body}>
        {'Que es la voluntad de las partes que la información suministrada sea tratada como información confidencial, con ocasión de servicios de: '}{v.trabajador_cargo}
      </Text>
      <Text style={S.body}>
        {'LAS PARTES han convenido celebrar el presente acuerdo de confidencialidad, el cual se regirá por las siguientes cláusulas.'}
      </Text>
      <Cl
        title="PRIMERA. DEFINICIÓN DE INFORMACIÓN CONFIDENCIAL:"
        body="Toda la información de cualquier clase que hasta este momento haya utilizado, conocido y/o haya suministrado directa o indirectamente LA PARTE REVELADORA a LA PARTE RECEPTORA, por cualquier medio; y específicamente por medios informáticos y tecnológicos, y/o la que se le entregue, utilice, conozca o se ponga a disposición para la ejecución del contrato laboral o de prestación de servicios; así como aquella información que en el futuro tenga que utilizar, conocer, entregarse y/o ponerse a disposición de LA PARTE RECEPTORA para definir la celebración y/o ejecución de cualquier negocio jurídico, es de carácter confidencial y privilegiada, entendiéndose ésta, sin excepción, aquella información de carácter técnico, comercial, información financiera, información de carácter operativo, procedimental, comercial, de clientes, de mercadeo, de negocios, descripciones y contenido de los negocios, proyectos, así como toda la información o documento de cualquier clase de carácter financiero, administrativo o legal y cualquier otra relacionada directa o indirectamente con los negocios o contratos que nos relacionan, a la que normalmente no tiene acceso libre al público en general y se le entregue a LA PARTE RECEPTORA en cualquier forma escrita y oral (sin que sea necesario manifestar expresamente su carácter confidencial y/o reservado), así como los resultados producto del procesamiento de la información de cualquier de LAS PARTES y por tanto, debe permanecer en reserva para todas aquellas personas no autorizadas expresamente para conocerla. Información confidencial comprende, pero no se limita a: documentos, mensajes de datos, comunicaciones, presentaciones, cifras, estudios, análisis, investigaciones, productos y servicios, pólizas, notas técnicas y sus características, proyecciones financieras, planes de negocio y de desarrollo, canales, estrategias y/o métodos de comercialización, promociones, descripción e identificación de socios, volúmenes estimados de negocio, información de contratos con terceros; información de costos; informes de mercadeo; especificaciones, diseño, dibujos, conceptos, datos, prototipos, mejoramentos, secretos industriales y know how; proyectos en desarrollo, investigaciones, procesos internos, inversiones, licencias, desarrollo de productos, adquisiciones, información de la Fundación, de los órganos de gobierno de la Fundación, de los clientes, de sus trabajadores, directivos, contratistas, proveedores, información de convenios, de contratación con empresas privadas y el Estado, elementos relacionados con la red de telecomunicaciones y plataformas; información de los clientes protegida por la reserva bancaria, número de cuenta, etc., trabajadores y/o accionistas; procesos, procedimientos, formatos; y cualquier otra información que no sea pública, que LA PARTE RECEPTORA conozca en virtud de la ejecución de la relación contractual y/o prestación de servicios. La mención de lo que dentro de este acuerdo se considera información confidencial, es meramente enunciativa. Dentro de la información confidencial se encuentra incluido el secreto empresarial, entendido de acuerdo con la definición consagrada en el Artículo 260 de la decisión 486 de 2000 de la Comisión de la Comunidad Andina. Este documento por sí solo constituye información confidencial, en cuanto a su contenido y existencia."
      />
      <Cl
        title="SEGUNDA. OBLIGACIÓN DE CONFIDENCIALIDAD:"
        body="LA PARTE RECEPTORA se obliga a no revelar a terceras personas la información confidencial que reciba de LA PARTE REVELADORA y, en consecuencia, se obliga a mantenerla de manera confidencial y privada, y a protegerla para evitar su divulgación y utilización, actuando con la mayor diligencia en la guarda y tratamiento de la información confidencial. De acuerdo con lo anterior, LA PARTE RECEPTORA deberá adoptar todas las medidas de seguridad y/o precauciones necesarias y apropiadas para proteger la información confidencial de LA PARTE REVELADORA. Así mismo LA PARTE RECEPTORA, se obliga a no revelar a ningún Tercero el contenido o existencia del presente acuerdo, sin previo consentimiento expreso y escrito de LA PARTE REVELADORA."
      />
      <Cl
        title="TERCERA. USO DE LA INFORMACIÓN CONFIDENCIAL:"
        body="LA PARTE RECEPTORA no podrá utilizar la información confidencial para ejercer actos de competencia desleal frente a LA FUNDACION NUEVO HORIZONTE o para fines comerciales y obtener beneficio propio o ajeno, directo o indirecto, sin importar si de tal forma no se causa un perjuicio a LA PARTE REVELADORA o a terceros y sólo la utilizará para los fines para los cuales fue entregada o divulgada."
      />
      <Cl
        title="CUARTA. PROPIEDAD DE LA INFORMACIÓN CONFIDENCIAL:"
        body="La información confidencial seguirá siendo propiedad exclusiva de LA PARTE REVELADORA y será devuelta inmediatamente, junto con todas las copias que de ella se hubiere hecho, a la terminación de su (contrato laboral), así como todo lo demás que tenga el trabajador y/o contratista de LA FUNDACION NUEVO HORIZONTE, y que haya recibido para poder ejecutar su labor; incluyendo la dotación que cuente con logos propios de la Fundación. La entrega de información confidencial y la suscripción del presente acuerdo, no concede a LA PARTE RECEPTORA autorización, permiso o derechos de autor o de cualquier otro derecho de propiedad industrial o intelectual. Ni este Acuerdo ni la entrega o recepción de información confidencial constituyen o implican promesa o intención de efectuar compra o venta de productos o servicios, o promesa de contrato de cualquier índole por cualquiera de las partes o compromisos con respecto a la comercialización presente o futura de cualquier producto o servicio.\nEl presente Acuerdo no implica restricción para LA PARTE REVELADORA de ninguna especie para la libre comercialización a terceros de su propia información confidencial, aun la que incluya modificaciones, alteraciones o adaptaciones de cualquier tipo o extensión. Por consiguiente, LA PARTE REVELADORA, en cualquier momento y sin notificar a la otra parte, podrán negociar, divulgar y tratar de cualquier manera y por cualquier motivo con terceros en lo relacionado con su propia información confidencial."
      />
      <Cl
        title="QUINTA. EJERCICIO AL DERECHO DE DAR A CONOCER INFORMACIÓN CONFIDENCIAL:"
        body="Este Acuerdo de Confidencialidad no obliga por sí solo a LA PARTE REVELADORA a dar a conocer información confidencial."
      />
      <Cl
        title="SEXTA. DURACIÓN DEL ACUERDO:"
        body="El presente Acuerdo de Confidencialidad permanecerá vigente por tiempo indefinido, LA PARTE RECEPTORA se obliga a mantener la confidencialidad de la información durante un periodo de diez (10) años más contados a partir del momento de terminación de la relación laboral y/o de prestación de servicios."
      />
      <Cl
        title="SÉPTIMA. ACUERDO TOTAL RESPECTO A LA INFORMACIÓN CONFIDENCIAL:"
        body="Este acuerdo representa el acuerdo total entre LAS PARTES con respecto a la información confidencial y será considerado un Anexo al (contrato laboral)."
      />
      <Cl
        title="OCTAVA. DAÑO IRREPARABLE:"
        body="Cada Parte reconoce que el incumplimiento de este Acuerdo podría causar un perjuicio irreparable. LA PARTE REVELADORA podrá tomar todas las medidas que sean necesarias que la Ley permita para evitar cualquier incumplimiento del Acuerdo o la utilización de la información confidencial. LA PARTE RECEPTORA reconoce que cualquier actuar en violación de las disposiciones de confidencialidad antes descritas podrá generar indemnización de perjuicios a favor de LA FUNDACION NUEVO HORIZONTE por presunta conducta de competencia desleal, de acuerdo con lo establecido en la Ley 256 de 1996 y otras normas comerciales y civiles. LA PARTE REVELADORA podrá reclamar judicial o extrajudicialmente el resarcimiento económico de todos los daños y perjuicios que el incumplimiento del presente acuerdo pudiera representarles. En el evento de divulgación o uso no autorizado de la información confidencial, ocurrida por revelaciones que haga LA PARTE RECEPTORA, ésta deberá desplegar los esfuerzos necesarios para asistir a LA PARTE REVELADORA en la recuperación y prevención del uso, diseminación, venta, y otra disposición de dicha información, además lo facultará para exigir la indemnización de perjuicios que se causen a ella o a terceros como consecuencia de la violación de la obligación de confidencialidad por LA PARTE RECEPTORA. Lo anterior, sin perjuicio de los demás derechos que tenga cada uno derivados de este Acuerdo o de la Ley."
      />
      <Cl
        title="NOVENA. RECEPCIÓN O REVELACIÓN DE INFORMACIÓN POR MEDIOS TECNOLÓGICOS O DE COMUNICACIONES:"
        body="Si durante el desarrollo del (contrato laboral) LAS PARTES utilizan infraestructura tecnológica o sistemas de comunicación, se requerirá de la utilización de medios de comunicación seguros y en cada caso la información se codificará y autenticará el origen y el destinatario. Al utilizar medios tales como el correo electrónico e internet, aplicarán las mismas medidas para seguridad que la información no sea vista ni modificada por personas diferentes o ajenas a los intereses de LA PARTE REVELADORA."
      />
      <Cl
        title="DÉCIMA. TRATAMIENTO DE DATOS PERSONALES:"
        body="En el caso que LA PARTE REVELADORA sea quien suministra los datos a LA PARTE RECEPTORA para su tratamiento, LA PARTE RECEPTORA, en relación con los datos personales de terceros, suministrados por LA PARTE REVELADORA para el cumplimiento de las funciones del (contrato laboral), LA PARTE RECEPTORA declara conocer que tales datos gozan de protección Constitucional, desarrollada a través de la Ley de Habeas Data y sus decretos reglamentarios, y por lo anterior se obliga a: (i) implementar las medidas de seguridad necesarias para impedir el acceso no autorizado así como cualquier uso no autorizado de los datos personales; (ii) garantizar a los titulares, en todo tiempo, el pleno y efectivo ejercicio del derecho de Habeas Data; (iii) devolver o destruir, según instrucción previa de LA PARTE REVELADORA, toda la información a la que se tenga acceso una vez finalizado el (contrato laboral). (iv) tratar, procesar y/o administrar los datos personales únicamente para el cumplimiento de las obligaciones establecidas en el (contrato laboral) y para las finalidades previstas en el mismo, de acuerdo con lo definido en su objeto; (v) informar a LA PARTE REVELADORA de la recepción de quejas, reclamos o requerimientos de información presentados por los titulares de los datos personales, dentro del día hábil siguiente al de la recepción, para que de una manera concertada se dé respuesta de fondo al objeto de la petición. (vi) guardar confidencialidad respecto de los datos personales suministrados y el tratamiento dado a los mismos, de acuerdo a lo previsto en el presente acuerdo de confidencialidad. (vii) mantener indemne a LA PARTE REVELADORA y o terceros por los daños y perjuicios que llegue a causar LA PARTE RECEPTORA, sus empleados, contratistas y/o subcontratistas, proveedores y terceras personas con quien la PARTE REVELADORA tenga convenios, contratos o relaciones comerciales, por el incumplimiento de las obligaciones señaladas en la presente cláusula o de la legislación colombiana en materia de Habeas Data."
      />
      <Cl
        title="DÉCIMA PRIMERA. LEGISLACIÓN APLICABLE Y DOMICILIO:"
        body="Para todos los efectos el domicilio contractual será el Municipio de Buga Valle y el acuerdo se regirá e interpretará de acuerdo con las leyes de la República de Colombia."
      />
      <Cl
        title="DÉCIMA SEGUNDA. CESIÓN DEL ACUERDO:"
        body="El presente Acuerdo de Confidencialidad, los derechos y deberes que se deriven del mismo no podrán ser objeto de cesión sin que medie expresa autorización o por común acuerdo de ambas partes."
      />
      <Cl
        title="DÉCIMA TERCERA. DIVISIBILIDAD DEL ACUERDO:"
        body="Si cualquier disposición del presente acuerdo fuere considerada ilegal, inválida o inejecutada por autoridad competente, las disposiciones restantes permanecerán en pleno vigor y efecto, siempre y cuando la disposición declarada ilegal, inválida o inejecutable no constituya el objeto esencial del acuerdo."
      />
      <Text style={S.body}>
        {'El presente acuerdo se suscribe entre las partes a los '}{v.dia_inicio}{' días del mes de '}{v.mes_inicio}{' del año '}{v.anio_inicio}{'.'}
      </Text>
      <View style={S.sigRow}>
        <View style={S.sigCol}>
          <Text style={S.sigLabel}>{'PARTE REVELADORA'}</Text>
          <Text style={{ height: 40 }} />
          <Text style={S.sigName}>{'DORA PATRICIA CARMONA SOTO'}</Text>
          <Text style={S.sigLine}>{'C.C. No. 29.158.068 de Ansermanuevo (V)'}</Text>
          <Text style={S.sigLine}>{'Representante Legal'}</Text>
          <Text style={S.sigLine}>{'FUNDACION NUEVO HORIZONTE'}</Text>
        </View>
        <View style={S.sigCol}>
          <Text style={S.sigLabel}>{'PARTE RECEPTORA'}</Text>
          <SigSpace firma={v.firma} />
          <Text style={S.sigName}>{v.trabajador_nombre}</Text>
          <Text style={S.sigLine}>{'C.C. No. '}{v.trabajador_cedula}</Text>
        </View>
      </View>
    </>
  )
}

function AppendixPreaviso({ v }: { v: ContractVars }) {
  return (
    <Page style={S.page}>
      <PageHeader />
      <PageFooter />
      <Text style={S.body}>
        {v.lugar_trabajo}{', '}{v.dia_preaviso}{' de '}{v.mes_preaviso}{' de '}{v.anio_preaviso}
      </Text>
      <Text style={S.body}>{'Señor(a).'}</Text>
      <Text style={S.body}>
        <B>{v.trabajador_nombre + '\n'}</B>
        {v.trabajador_cargo + '\n'}
        <B>{'FUNDACION NUEVO HORIZONTE\n'}</B>
        {'Ciudad'}
      </Text>
      <Text style={[S.body, S.bold]}>
        {'REFERENCIA:   PREAVISO DEL VENCIMIENTO DEL PLAZO FIJO PACTADO EN EL CONTRATO LABORAL, ARTÍCULO 46 NUMERAL 1 C. S. T. (REFORMADO POR EL ARTÍCULO 6 DE LA LEY 2466 DE 2025)'}
      </Text>
      <Text style={S.body}>{'Cordial saludo,'}</Text>
      <Text style={S.body}>
        {'La '}
        <B>{'FUNDACION NUEVO HORIZONTE'}</B>
        {' le informa que el contrato laboral a término fijo inferior a un año, suscrito con usted y con vigencia del '}{v.dia_inicio}{' de '}{v.mes_inicio}{' de '}{v.anio_inicio}{' al '}{v.fecha_terminacion_texto}{', no será prorrogado al vencimiento del plazo pactado, de conformidad con lo establecido en el artículo 46 del Código Sustantivo del Trabajo (reformado por el artículo 6 de la Ley 2466 de 2025).\nEsta decisión se comunica con una anticipación no inferior a treinta (30) días calendario, correspondiente al tiempo restante de la prórroga, cumpliendo así con los requisitos legales para los efectos a que haya lugar.'}
      </Text>
      <Text style={S.body}>{'De usted atentamente,'}</Text>
      <View style={S.sigRow}>
        <View style={S.sigCol}>
          <Text style={S.sigLabel}>{'EL EMPLEADOR'}</Text>
          <Text style={{ height: 40 }} />
          <Text style={S.sigName}>{'DORA PATRICIA CARMONA SOTO'}</Text>
          <Text style={S.sigLine}>{'C.C. 29.158.068 de Ansermanuevo (V)'}</Text>
          <Text style={S.sigLine}>{'Representante Legal'}</Text>
          <Text style={S.sigLine}>{'FUNDACION NUEVO HORIZONTE'}</Text>
        </View>
        <View style={S.sigCol}>
          <Text style={S.sigLabel}>{'EL TRABAJADOR'}</Text>
          <SigSpace firma={v.firma} />
          <Text style={S.sigName}>{v.trabajador_nombre}</Text>
          <Text style={S.sigLine}>{'C.C. '}{v.trabajador_cedula}</Text>
          <Text style={S.sigLine}>{'Tel: '}{v.trabajador_telefono}</Text>
        </View>
      </View>
    </Page>
  )
}

// ── Laboral shared clauses after DECIMA ────────────────────────────────────

function ClausesLaboralTail({ v }: { v: ContractVars }) {
  return (
    <>
      <Text style={S.body}>
        <Text style={S.underlineBold}>{'DECIMA. - FUNCIONES ESPECIALES DEL TRABAJADOR:'}</Text>
        {'  Las Funciones que desarrollará el trabajador para el cargo de '}
        <Text style={S.bold}>{v.trabajador_cargo}</Text>
        {', quedan establecidas en el MANUAL DE FUNCIONES que se anexa al presente contrato y hace parte integral del mismo.'}
      </Text>
      <Cl
        title="DECIMA PRIMERA. - PROHIBICIONES AL TRABAJADOR:"
        body={'Además de las prohibiciones establecidas en la ley y en los reglamentos, EL TRABAJADOR se obliga a atender las siguientes: 1. Solicitar préstamos especiales, dádivas, bonificaciones o ayuda económica a los adultos mayores, familiares, contratistas y proveedores de EL EMPLEADOR aprovechándose de su cargo u oficio o aceptarles donaciones de cualquier clase sin la previa autorización escrita de EL EMPLEADOR. 2. Autorizar o ejecutar sin ser de su competencia, operaciones que afecten los intereses de EL EMPLEADOR o negociar bienes y/o servicios de EL EMPLEADOR en provecho propio o de terceros. 3. Retener dinero, cheques o documentos o hacer efectivos cheques recibidos para entregar a EL EMPLEADOR. 4. Realizar cualquier actitud o comportamiento en las actividades, personales o en las relaciones sociales, que puedan afectar en forma nociva la reputación o buen nombre de EL EMPLEADOR. 5. Retirar de las instalaciones de la Fundación los vehículos, repuestos, insumos, elementos, equipos, elementos, implementos, máquinas y útiles de propiedad de EL EMPLEADOR o de los residentes sin su autorización escrita. 6. Utilizar los vehículos, elementos, implementos de trabajo, equipos y bienes de la Fundación para realizar actividades de carácter personal. 7. Apropiarse de los objetos personales de los adultos mayores, tales como ropa, dinero, insumos, medicamentos, joyas, elementos o implementos para su arreglo personal, entre otros. 8. Entregar información de carácter confidencial a cualquier persona, sin la expresa autorización por escrito; 9. Guardar silencio o no reportar a EL EMPLEADOR en forma inmediata, cualquier hecho grave que ponga en peligro la seguridad de las personas, los bienes o finanzas de la Fundación.'}
      />
      <Cl
        title="DÉCIMA SEGUNDA.- TERMINACION UNILATERAL:"
        body={'Son justas causas para dar por terminado unilateralmente este Contrato, por cualquiera de las partes, las enumeradas en los artículos 61 y 62  del C.S.T., modificados por el artículo 5º de la Ley 50 de 1.990 y artículo 7º del Decreto 2351/65,  y además por parte del EMPLEADOR, las faltas que para efecto se califiquen como graves en reglamentos y demás documentos que contengan reglamentaciones, órdenes, instrucciones o prohibiciones de carácter general o particular, pactos, convenciones colectivas, laudos arbitrales y las que expresamente convengan calificar por escrito que formaran parte integral del presente contrato.'}
      />
      <Para body={'La aplicación de cualquiera de las causales de terminación requerirá el previo agotamiento del procedimiento disciplinario establecido en el artículo 7° de la Ley 2466 de 2025, garantizando al TRABAJADOR(A) el derecho al debido proceso, incluyendo la formulación de cargos, el otorgamiento de un término razonable para su defensa, la valoración objetiva de las pruebas y la imposición proporcional de la sanción disciplinaria correspondiente, en caso de comprobarse la falta.'} />
      <Cl
        title="DÉCIMA TERCERA. -  LUGAR DE TRABAJO y TRASLADOS:"
        body={'El empleador contará con los servicios del trabajador en funciones relacionadas con las actividades de la Fundación. El trabajador efectuará sus funciones en la Centro vida/día - del Municipio de Buga, en los lugares o sitios que para tal efecto se le indique o le asigne EL EMPLEADOR, o en cualquier otra ciudad o sucursal que determine el empleador o dependencia de su Fundación o fuera de ella, declarando EL TRABAJADOR que está en disponibilidad de hacerlo. Igualmente, EL trabajador acepta desde ahora los traslados del lugar de trabajo y cambios de oficio que decida el empleador, de acuerdo con las necesidades del trabajo, la Naturaleza de la labor contratada y el servicio que presta EL EMPLEADOR, siempre y cuando que tales traslados o cambios no desmejoren sus condiciones de remuneración y sin que se afecte el honor, la dignidad y los derechos mínimos del trabajador, de conformidad con el artículo 23 del C.S.T., modificado por la Ley 50 de 1.990, artículo 1º.'}
      />
      <Cl
        title="DÉCIMA CUARTA. - DOMICILIO CONTRACTUAL:"
        body={'De común acuerdo entre las partes se fija como domicilio, la ciudad de Buga, para efectos de cualquier reclamación de carácter laboral, derivada de la interpretación del presente contrato de trabajo o controversia jurídica suscitada por la terminación del mismo. El trabajador se compromete a informar por escrito y de manera inmediata a la Fundación Nuevo Horizonte, cualquier cambio en su dirección registrada en su hoja de vida.'}
      />
      <Cl
        title="DÉCIMA QUINTA. - APLICACIÓN DEL REGLAMENTO DE TRABAJO:"
        body={'El (la) trabajador(a) declara haber recibido copia del Reglamento de Trabajo vigente al momento de su vinculación y se compromete a cumplir con las disposiciones allí contenidas, especialmente en lo relacionado con las obligaciones y las prohibiciones del trabajador(a), sin perjuicio de lo anterior, deberá conocerlo en su totalidad.'}
      />
      <Cl
        title="DÉCIMA SEXTA. - SEGURIDAD SOCIAL:"
        body={'Es obligación especial del Trabajador informar por escrito, con los documentos soporte a la Fundación Nuevo Horizonte, el nombre de las entidades a las que se encuentra afiliado o desea ser afiliado al sistema de seguridad social en salud y pensión. De igual manera deberá aportar toda la documentación personal y de sus beneficiarios que sea requerida por la caja de compensación familiar e informar cualquier modificación que sea necesaria registrarse durante la ejecución del presente contrato.'}
      />
      <Para label="PARÁGRAFO PRIMERO:" body={'El Trabajador deberá presentar la documentación completa requerida para su afiliación en un plazo máximo de un (1) día, con el objeto de cumplir las obligaciones legales.'} />
      <Para label="PARÁGRAFO SEGUNDO:" body={'La no entrega de la documentación en el plazo aquí señalado, exonera al Empleador de cualquier responsabilidad.'} />
      <Cl
        title="DÉCIMA SEPTIMA. - BUENA FE CONTRACTUAL:"
        body={'Este contrato ha sido redactado estrictamente de acuerdo a la Ley y la Jurisprudencia y será interpretado de buena fe y en consonancia con el Código Sustantivo del Trabajo cuyo objetivo, definido en su artículo 1º es lograr la justicia en las relaciones entre empleadores y trabajadores dentro de un espíritu de coordinación económica y equilibrio social.'}
      />
      <Cl
        title="DÉCIMA OCTAVA. - NOVACION E INTEGRALIDAD:"
        body={'El presente contrato reemplazará en su integridad y deja sin efecto alguno cualquiera otro contrato verbal o escrito celebrado entre las partes con anterioridad, las modificaciones que se acuerden al presente contrato se anotarán a continuación de su texto.'}
      />
      <Text style={S.body}>
        {'Para constancia se firma en dos (2) ejemplares del mismo tenor y valor, ante testigos en Guadalajara de Buga - Valle del Cauca, a los '}{v.dia_inicio}{' días del mes de '}{v.mes_inicio}{' del año ('}{v.anio_inicio}{'}).'}
      </Text>
      <View style={S.sigRow}>
        <View style={S.sigCol}>
          <Text style={S.sigLabel}>{'EL EMPLEADOR'}</Text>
          <Text style={{ height: 40 }} />
          <Text style={S.sigName}>{'DORA PATRICIA CARMONA SOTO'}</Text>
          <Text style={S.sigLine}>{'C.C. 29.158.068 De Ansermanuevo (V).'}</Text>
          <Text style={S.sigLine}>{'Representante Legal'}</Text>
          <Text style={S.sigLine}>{'Fundación Nuevo Horizonte.'}</Text>
        </View>
        <View style={S.sigCol}>
          <Text style={S.sigLabel}>{'EL TRABAJADOR'}</Text>
          <SigSpace firma={v.firma} />
          <Text style={S.sigName}>{v.trabajador_nombre}</Text>
          <Text style={S.sigLine}>{'C.C. '}{v.trabajador_cedula}</Text>
          <Text style={S.sigLine}>{'Tel: '}{v.trabajador_telefono}</Text>
        </View>
      </View>
    </>
  )
}

// ── Laboral contract header table ───────────────────────────────────────────

function LaboralInfoTable({ v }: { v: ContractVars }) {
  return (
    <View style={S.table}>
      <TR label="CONTRATO No." value={v.contrato_numero} />
      <TR label="EMPLEADOR:" value="FUNDACION NUEVO HORIZONTE NIT:821.003.251-4" />
      <TR label="TRABAJADOR:" value={v.trabajador_nombre} />
      <TR label="OFICIO QUE DESEMPEÑARA" value={v.trabajador_cargo} />
      <TR label="SALARIO" value={v.salario_texto} />
      <TR label="FORMA DE PAGO" value="MENSUAL LOS CINCO PRIMEROS DIAS DE CADA MES" />
      <TR label="FECHA DE INICIO:" value={v.fecha_inicio_texto} />
      <TR label="FECHA DE TERMINACION DEL CONTRATO:" value={v.fecha_terminacion_texto} />
      <TR label="LUGAR DONDE SE DESEMPEÑARÁN LAS LABORES:" value={v.lugar_trabajo} />
    </View>
  )
}

// ── Laboral intro paragraph ─────────────────────────────────────────────────

function LaboralIntro({ v }: { v: ContractVars }) {
  return (
    <Text style={S.body}>
      {'En la ciudad de Guadalajara de Buga Valle, a los '}
      <B>{v.dia_inicio}</B>
      {' día del mes de '}
      <B>{v.mes_inicio}</B>
      {' del año '}
      <B>{v.anio_inicio}</B>
      {', entre los suscritos '}
      <B>{'DORA PATRICIA CARMONA SOTO'}</B>
      {' identificada con CC. '}
      <B>{'Nº. 29.158.068'}</B>
      {' expedida en Ansermanuevo (Valle Del Cauca), en su calidad de Representante legal de la '}
      <B>{'FUNDACION NUEVO HORIZONTE NIT:821.003.251-4'}</B>
      {' y con domicilio principal en la ciudad de Guadalajara de Buga Valle del Cauca, quien en adelante se denominará '}
      <B>{'EL EMPLEADOR'}</B>
      {' y '}
      <B>{v.trabajador_nombre}</B>
      {' identificada/o con cedula de ciudadanía '}
      <B>{`Nº ${v.trabajador_cedula}`}</B>
      {' quien en adelante se denominará '}
      <B>{'EL TRABAJADOR'}</B>
      {', se ha celebrado el presente contrato individual de trabajo, el cual se rige por el Código Sustantivo de Trabajo y  por las siguientes cláusulas:'}
    </Text>
  )
}

// ── PRIMERA with CONVENIO placeholder ──────────────────────────────────────

function ClausesPrimera({ v }: { v: ContractVars }) {
  return (
    <Text style={S.body}>
      <Text style={S.underlineBold}>{'PRIMERA.- OBJETO:'}</Text>
      {'  El Empleador contrata los servicios personales del trabajador y este  se obliga a poner al servicio del empleador toda su capacidad normal de trabajo, en forma exclusiva, en el desempeño de las funciones propias del oficio mencionado y en las labores anexas y complementarias del mismo, de conformidad con las órdenes e instrucciones que le imparta el empleador o sus representantes y a no prestar directa, ni indirectamente servicios laborales a otros empleadores, ni a trabajar por cuenta propia en el mismo oficio. '}
      <B>{'PARÁGRAFO:'}</B>
      {' Las partes acuerdan celebrar este contrato a término fijo en atención a la necesidad objetiva y temporal de cubrir el cargo mencionado, cuya naturaleza justifica una vinculación limitada en el tiempo, debido a la contratación con el Municipio de Guadalajara De Buga – '}
      <B>{`CONVENIO SBSDC-2200-0532-${v.anio_inicio}`}</B>
      {', que tiene por objeto: MEJORAR LAS CONDICIONES DE 175 PERSONAS MAYORES EN CONDICIÓN DE VULNERABILIDAD, AISLAMIENTO O CARENCIA DE SOPORTE SOCIAL A TRAVÉS DE LA FINANCIACION DEL CENTRO VIDA DEL MUNICIPIO DE GUADALAJARA DE BUGA;  Esta justificación se hace conforme a lo dispuesto en el artículo 5 de la Ley 2466 de 2025, que exige la expresión clara de las razones objetivas que justifican la modalidad contractual.'}
    </Text>
  )
}

// ── ContratoTiempoCompleto ─────────────────────────────────────────────────

const OCTAVA_COMPLETO =
  'El trabajador se obliga a laborar la jornada ordinaria en los turnos y dentro de las horas señaladas por el empleador, pudiendo hacer este ajuste o cambios de horario cuando lo estime conveniente. Por el acuerdo expreso o tácito de las partes, podrán repartirse las horas de la jornada ordinaria en la forma prevista en el artículo 164 del Código Sustantivo del Trabajo, teniendo en cuenta que los tiempos de descanso entre las secciones de la jornada no se computan dentro de la misma según el artículo 167 ibidem. De común acuerdo se establece que la jornada nocturna y las horas extras nocturnas se liquidarán teniendo en cuenta lo dispuesto en la reforma laboral (Ley 2466 de 2025). Esto es después de las 7:00 P.M.'

const OCTAVA_PARCIAL =
  'El trabajador se obliga a laborar bajo la modalidad de jornada parcial, con una duración de treinta y seis horas semanales distribuidas acorde a las necesidades de la Fundación, el empleador podrá hacer ajuste o cambios de horario cuando lo estime conveniente, sin exceder el límite legal establecido para los trabajadores a tiempo parcial, conforme a la legislación vigente. La jornada de trabajo se desarrollará dentro de los límites permitidos por la legislación vigente y no generará el derecho al pago de recargos nocturnos, dominicales o festivos, salvo que se laboren en dichos horarios, en cuyo caso se reconocerán los recargos conforme a la normativa aplicable. Cualquier modificación en la distribución de la jornada deberá ser acordada entre las partes por escrito, notificándose con una antelación mínima de dos días y respetando las disposiciones legales vigentes.\nPARÁGRAFO 1: El trabajador realiza sus funciones durante un menor número de horas que una jornada completa, sin que esto implique la pérdida de sus derechos laborales, los cuales se liquidan proporcionalmente a la duración de su jornada.'

function ContratoLaboral({ v, titulo, octavaBody }: { v: ContractVars; titulo: string; octavaBody: string }) {
  return (
    <Document>
      {/* Main contract */}
      <Page style={S.page}>
        <PageHeader />
        <PageFooter />
        <View style={S.titleBlock}>
          <Text style={S.title}>{'CONTRATO INDIVIDUAL DE TRABAJO'}</Text>
          <Text style={S.title}>{titulo}</Text>
        </View>
        <LaboralInfoTable v={v} />
        <LaboralIntro v={v} />
        <ClausesPrimera v={v} />
        <ClausesLaboralCommonPart1 v={v} octavaBody={octavaBody} />
      </Page>
      <Page style={S.page}>
        <PageHeader />
        <PageFooter />
        <ClausesLaboralTail v={v} />
      </Page>
      {/* Blank separator page */}
      <Page style={S.page}>
        <PageHeader />
        <PageFooter />
      </Page>
      {/* Appendices page */}
      <Page style={S.page}>
        <PageHeader />
        <PageFooter />
        <AppendixAutorizacionImagenes v={v} />
        <AppendixDatosPersonales v={v} />
        <AppendixConfidencialidad v={v} />
      </Page>
      {/* Preaviso */}
      <AppendixPreaviso v={v} />
    </Document>
  )
}

// Helper: all shared clauses SEGUNDA through DECIMA (minus tail)
function ClausesLaboralCommonPart1({ v, octavaBody }: { v: ContractVars; octavaBody: string }) {
  return (
    <>
      <Cl
        title="SEGUNDA. - CONFIDENCIALIDAD y HABEAS DATA:"
        body={'El (la) trabajador(a) no podrá divulgar información confidencial a la cual tenga acceso con motivo de sus obligaciones, sin autorización del empleador excepto en aquellos casos en que lo exijan las leyes tributarias, de seguridad social, penales o para dar cumplimientos a requerimiento de autoridades o jueces de la República, en especial no podrá revelar a terceros lo siguiente: a). Los términos de éste contrato, salvo para darlo a conocer a su abogado. b). Información de cualquier naturaleza relacionada con la Fundación o sus respectivos clientes, incluyendo sin limitación alguna, las políticas de Fundación, las operaciones sociales, operaciones financieras, técnicas de negocios, técnicas de mercadeo, cuentas y personal de la Fundación. c). Información o datos usados por el empleador para la conducción de sus negocios. d). Información y datos obtenidos por el trabajador(a) que sea de propiedad de la Fundación o de un tercero y que el trabajador(a) este obligado a tratar como confidencial. e). Toda la información del empleador y de terceros con quien realice negocios que esté protegida por la Ley Estatutaria 1581 de 2012, (Ley de protección de datos personales), que el trabajador conozca en razón de su contrato, análisis de mercado y del consumidor, actividades promocionales, de investigación y creación de nuevos productos, creación de comunidades de clientes o personas con fines comerciales o de mercadeo y cantidades de producción. La obligación de la reserva del trabajador(a) será permanente salvo que el empleador haga pública dicha información.'}
      />
      <Cl
        title="TERCERA. - CESIÓN DE USO DE IMAGEN:"
        body={'En caso que el (a) trabajador(a) aparezca en fotografías, videos, grabaciones, reproducciones, entre otras, con fines publicitarios, con relación y en la ejecución del presente contrato, respecto de los productos y servicios que se comercializan en la FUNDACIÓN NUEVO HORIZONTE, el trabajador(a) cede su derecho de uso de imagen al empleador; la cesión comprende la divulgación de obra fotográfica, derecho de reproducción, derecho de distribución, derecho de explotación comercial, derecho de comunicación pública, derecho de transformación a favor de la Fundación  y sus representantes, de forma exclusiva y a título universal.'}
      />
      <Cl
        title="CUARTA. - RESPONSABILIDADES SISTEMA DE GESTIÓN DE LA SEGURIDAD Y SALUD EN EL TRABAJO (SG-SST):"
        body={'El trabajador se obliga a cumplir estrictamente las responsabilidades contenidas en el artículo 10 del Decreto 1443 de 2014- Sistema de Gestión de la Seguridad y Salud en el Trabajo (SG-SST), las cuales son las siguientes: 1. Procurar el cuidado integral de su salud; 2. Suministrar información clara, veraz y completa sobre su estado de salud; 3. Cumplir las normas, reglamentos e instrucciones del Sistema de Gestión de la Seguridad y Salud en el Trabajo de la Fundación; 4. Informar oportunamente al empleador o contratante acerca de los peligros y riesgos latentes en su sitio de trabajo; 5. Participar en las actividades de capacitación en seguridad y salud en el trabajo definido en el plan de capacitación del SG–SST; y 6. Participar y contribuir al cumplimiento de los objetivos del Sistema de Gestión de la Seguridad y Salud en el Trabajo SG-SST.'}
      />
      <Cl
        title="QUINTA. – RESPONSABILIDADES PLAN ESTRATÉGICO DE SEGURIDAD VIAL (PESV):"
        body={'El (la) trabajador(a) se obliga a cumplir estrictamente las responsabilidades contenidas en el Plan Estratégico y la Política de Seguridad Vial de la Fundación, siguiendo la reglamentación establecida en la Ley 769 de 2002, Código Nacional de Tránsito Terrestre.'}
      />
      <Cl
        title="SEXTA. - REMUNERACIÓN:"
        body={'El Empleador pagará al trabajador por la prestación de sus servicios, el salario indicado, pagadero en las oportunidades también señaladas arriba. Dentro de este pago se encuentra la remuneración de los descansos dominicales y festivos de que tratan los capítulos I, II, y III del Título VII del Código Sustantivo del Trabajo. Los pagos se harán en las oficinas de EL EMPLEADOR o mediante el abono en cuenta de EL TRABAJADOR. '}
      />
      <Para body={'PAGOS QUE NO CONSTITUYEN SALARIO. Las partes contratantes expresamente acuerdan lo siguiente: a) Que no tendrán calidad de salario para ningún efecto laboral, dentro de las previsiones y términos del artículo 128 del C.S. del T. en la forma como fue modificado por el artículo 15 de la Ley 50 de 1.990,  los auxilios o beneficios económicos, los auxilios por alimentación, habitación o vestuario, las primas extralegales de servicios, vacaciones, navidad, semestrales o de cualquier otro orden que EL EMPLEADOR reconozca a EL TRABAJADOR y a su familia en forma ocasional o habitual ya sea por su libre voluntad, por convenio contractual, convención colectiva, pacto o laudo arbitral, así como cualquier otro dinero que reciba EL TRABAJADOR para su desplazamiento fuera de su sitio de trabajo u otro pago efectuado por mera liberalidad, dentro de la vigencia del presente contrato tales como bonificaciones, auxilios por calamidad doméstica, auxilios por educación, pólizas de seguro, auxilio de transporte intermunicipal, auxilios de mantenimiento de vehículos, auxilio para vivienda, alimentación, auxilios para telefonía celular y demás conceptos diferentes al salario estipulado; b) De conformidad con lo dispuesto en el artículo 130 del C.S. del T., las sumas o pagos efectuados por mera liberalidad de EL EMPLEADOR no constituye salario para ningún efecto laboral, ni se computan al salario base para efectuar los pagos de aportes de seguridad social ni de parafiscalidad siempre que no sobrepasen el 40% del total devengado por el trabajador (Ley 1393 de 2010).'} />
      <Cl
        title="SÉPTIMA. - DURACIÓN Y PERIODO DE PRUEBA:"
        body={'El presente contrato se celebra a término fijo conforme a lo dispuesto en el artículo 5 de la Ley 2466 de 2025. Podrá renovarse por el mismo término o uno inferior. Si antes de la fecha del vencimiento de este término ninguna de las partes avisaré a la otra su determinación de no prorrogar el contrato, con antelación no inferior a 30 días calendario, este se entenderá prorrogado por un período igual al inicialmente pactado. Tratándose de un contrato a término fijo inferior a un año, únicamente podrá prorrogarse sucesivamente el contrato hasta por tres (3) períodos iguales o inferiores al cabo de los cuales el término de renovación no podrá ser inferior a un año y por un término no mayor a cuatro (4) años.  '}
      />
      <Para body={'En cumplimiento de lo establecido en el artículo 5 de la Ley 2466 de 2025, el empleador se abstendrá de celebrar de manera sucesiva contratos a término fijo con el mismo trabajador(a) para realizar funciones permanentes y habituales sin que exista una causa objetiva y comprobable que lo justifique. Las partes acuerdan un período de prueba, que no es superior a la quinta parte (5ª) parte del término inicial de éste contrato, no excede de dos (02) meses. En caso de prórrogas, se entenderá que no hay nuevo período de prueba, de acuerdo con lo dispuesto por el artículo 78 del C.S.T., modificado por el artículo 7º de la Ley 50/90. Durante este período tanto el empleador como el trabajador(a) podrán terminar el contrato en cualquier tiempo, sin que se cause el pago de indemnización alguna por parte del EMPLEADOR en forma unilateral de conformidad al Artículo 80 del C.S.T., modificado por el 3º. Del Decreto 617/54.'} />
      <Cl title="OCTAVA.-JORNADA DE TRABAJO:" body={octavaBody} />
      <Cl
        title="NOVENA. - OBLIGACIONES ESPECIALES DEL TRABAJADOR:"
        body={'Además de las funciones propias del cargo desempeñado por el trabajador, deberá cumplir con las obligaciones especiales establecidas en la ley y en los reglamentos, por tanto, EL TRABAJADOR se compromete a cumplir con las siguientes obligaciones especiales: 1. Guardar estricta reserva de todo cuanto llegue a su conocimiento por razón de su oficio o por La naturaleza de sus funciones y a los secretos o aspectos confidenciales cuya comunicación a otras personas pueda causar perjuicio a EL EMPLEADOR y/o a la FUNDACIÓN o personas contratantes de éste. 2. Aceptar todo cambio de función u oficio que disponga EL EMPLEADOR cuando tales cambios no desmejoren las condiciones laborales de EL TRABAJADOR y sean concordantes con el objeto del contrato. 3. Informar a EL EMPLEADOR con la debida anticipación sobre cualquier circunstancia a causa justificada que le impida ir al lugar de trabajo. 4. Cumplir con las metas y los objetivos individuales y de grupo establecidos por EL EMPLEADOR. 5. Realizar personalmente la labor encomendada en los turnos y jornadas dispuestas por EL EMPLEADOR y dentro del horario señalado por este último. 6. Laborar todos y cada uno de los días de descanso obligatorio, cuando las necesidades del servicio así lo requieran o cuando EL EMPLEADOR lo requiera. 7. Formular sus reclamos por liquidaciones de salarios o pagos de salarios que considere erradas o incompletas dentro de los diez (10) días siguientes a la fecha de pago ordinario del reclamo. 8. Entregar a un representante autorizado de EL EMPLEADOR, y a la terminación de este contrato, por cualquier causa, los equipos, elementos, implementos, vehículos, valores, documentos, dotación de trabajo, inventarios o herramientas de trabajo de propiedad de EL EMPLEADOR y a abandonar inmediatamente sus locales o instalaciones. 9. Asistir puntualmente a las reuniones que efectúe EL EMPLEADOR a las cuales hubiere sido citado. 10. Observar completa armonía y comprensión con los adultos mayores, visitantes, con sus superiores y compañeros de trabajo, en sus relaciones personales y en la ejecución de su labor. 11. Cumplir permanentemente sus labores con espíritu de lealtad, colaboración y disciplina con EL EMPLEADOR 12. Permanecer despierto y atento durante toda la jornada de trabajo.13. Dar aviso inmediato a EL EMPLEADOR de cualquier falla o desperfecto que presente alguna de las herramientas, vehículos o elementos de trabajo y propender por su pronta reparación o revisión. 14. Presentarse a laborar cuando la necesidad de este trabajo se presente de manera imprevista o inaplazable. 15. Avisar oportunamente y por escrito a EL EMPLEADOR todo cambio en su dirección, teléfono o ciudad de residencia, teniéndose como suya, para todos los efectos, la última dirección registrada en la Fundación. 16. Prestar los servicios asistenciales para el cargo contratado con la calidad, responsabilidad, idoneidad y adherencia al sistema de gestión de calidad exigida por la organización, los usuarios y clientes de la institución.'}
      />
    </>
  )
}

// ── ContratoPrestacionServicios ─────────────────────────────────────────────

function ContratoPrestacionServicios({ v }: { v: ContractVars }) {
  return (
    <Document>
      <Page style={S.page}>
        <PageHeader />
        <PageFooter />
        <View style={S.titleBlock}>
          <Text style={S.title}>{'CONTRATO DE PRESTACION DE SERVICIOS DE APOYO A LA GESTION'}</Text>
        </View>
        <View style={S.table}>
          <TR label="CONTRATO No." value={v.contrato_numero} centered />
          <TR label="CONTRATANTE:" value="FUNDACION NUEVO HORIZONTE NIT:821.003.251-4" centered />
          <TR label="CONTRATISTA:" value={v.trabajador_nombre} centered />
          <TR label="OBJETO DEL CONTRATO" value={v.trabajador_cargo} centered />
          <TR label="VALOR DEL CONTRATO" value={v.salario_texto} centered />
          <TR label="FORMA DE PAGO" value="MENSUAL (LOS CINCO PRIMEROS DIAS DE CADA MES)" centered />
          <TR label="FECHA DE INICIO:" value={v.fecha_inicio_texto} centered />
          <TR label="FECHA DE TERMINACION DEL CONTRATO:" value={v.fecha_terminacion_texto} centered />
          <TR label="LUGAR DONDE SE DESEMPEÑARÁN LAS LABORES:" value={v.lugar_trabajo} centered />
        </View>
        <Text style={S.body}>
          {'En la ciudad de '}{v.lugar_trabajo}{', a los ('}{v.dia_inicio}{') días del mes de '}{v.mes_inicio}{' del año '}{v.anio_inicio}{', entre los suscritos '}
          <B>{'DORA PATRICIA CARMONA SOTO'}</B>
          {' identificada con CC. Nº. 29.158.068 expedida en Ansermanuevo (Valle Del Cauca), en su calidad de Representante legal de la '}
          <B>{'FUNDACION NUEVO HORIZONTE NIT:821.003.251-4'}</B>
          {' y con domicilio principal en la ciudad de '}{v.lugar_trabajo}{' del Cauca, quien en adelante se denominara EL CONTRATANTE y '}{v.trabajador_nombre}{' identificada con cedula de ciudadanía N° '}{v.trabajador_cedula}{' quien en adelante se denominara EL CONTRATISTA; se ha convenido celebrar el presente contrato. de prestación de servicios, que se regirá por las normas legales pertinentes, en especial por los artículos 2054, 2055, 2056 y 2659 del Código Civil, el artículo 968 del Código de Comercio y por las siguientes'}
        </Text>
        <Text style={[S.body, S.bold]}>{'CONSIDERACIONES:'}</Text>
        <Text style={[S.body, S.indent]}>
          {'I.     La necesidad de personal para el área de Gerontología del centro Vida/día de la Fundación Nuevo Horizonte en atención al adulto mayor.\n'}
          {'II.    El Contratante necesita personal idóneo y suficiente, con conocimientos y experiencia.\n'}
          {'III.   Que para efectos de fortalecer la capacidad de gestión y de atención de la Fundación Nuevo Horizonte y el desarrollo de su objeto social, se hace necesario contar con una persona que sirva de apoyo al desarrollo de las actividades establecidas por la misma en relación con los Centros Vida para el Adulto Mayor.\n'}
          {'IV.   Que, conforme a los documentos aportados, EL CONTRATISTA demostró que reúne los requisitos de idoneidad y experiencia necesarios para la prestación de los servicios requeridos, siendo viable su contratación. En consecuencia, el contrato se regirá por las siguientes cláusulas.'}
        </Text>
        <Text style={S.body}>
          <B>{'PRIMERA. - OBJETO DEL CONTRATO:'}</B>
          {' Prestar los servicios profesionales, Gerontóloga, ofreciendo al CONTRATANTE, sus conocimientos y experiencia profesional especializada en el área. Para efectos de dar cumplimiento al contrato. '}
          <B>{'SEGUNDA. - VALOR DEL CONTRATO:'}</B>
          {' Para efectos fiscales y legales se estiman los servicios prestados en un valor mensual de '}{v.salario_texto}{' - para un valor total de ('}{v.valor_total_contrato}{')'}{' según cronograma entregado. '}
          <B>{'TERCERA. - FORMA DE PAGO.'}</B>
          {' LA FUNDACION cancelará a EL CONTRATISTA el valor del presente contrato mensualmente y/o proporcional al tiempo de servicios durante la vigencia del contrato. Los pagos se realizarán a través de transferencia electrónica de fondos en cuenta corriente o cuenta de ahorros en la entidad Bancaria donde el contratista indique, los primeros cinco (05) días de cada mes, previo cumplimiento de los requisitos que para ello se exige (Informe mensual de las actividades realizadas, cuenta de cobro, pago de la seguridad social al día y firma de autorización por parte del Representante Legal, etc)   '}
          <B>{'CUARTA.-DURACIÓN DEL CONTRATO.'}</B>
          {' El presente contrato tendrá una duración de '}{v.duracion_dias_texto}{', contados a partir del '}{v.fecha_inicio_texto}{' hasta el '}{v.fecha_terminacion_texto}{'. Sin embargo, las partes de común acuerdo podrán terminar o ampliar el plazo. '}
          <B>{'QUINTA. - OBLIGACIONES DE LAS PARTES:'}</B>
          {' 1. OBLIGACIONES DEL CONTRATISTA: a) cumplir con todo lo relacionado con el objeto del contrato y demás actividades inherentes al presente contrato, así no hayan sido pactadas, pero que tengan relación directa e inmediata con el objeto del contrato. '}
          <B>{'CONFIDENCIALIDAD y HABEAS DATA:'}</B>
          {' El (la) Contratista (a) no podrá divulgar información confidencial a la cual tenga acceso con motivo de sus obligaciones, sin autorización del CONTRATANTE excepto en aquellos casos en que lo exijan las leyes tributarias, de seguridad social, penales o para dar cumplimientos a requerimiento de autoridades o jueces de la República, en especial no podrá revelar a terceros lo siguiente: a). Los términos de éste contrato, salvo para darlo a conocer a su abogado. b). Información de cualquier naturaleza relacionada con la Fundación o sus respectivos clientes, incluyendo sin limitación alguna, las políticas de la Fundación, las operaciones sociales, operaciones financieras, técnicas de negocios, técnicas de mercadeo, cuentas y personal de la Fundación. c). Información o datos usados por el contratante para la conducción de sus negocios. d). Información y datos obtenidos por el contratista (a) este obligado a tratar como confidencial. e). Toda la información del contratante  y de terceros con quien realice negocios que éste protegida por la Ley Estatutaria 1581 de 2012, (Ley de protección de datos personales), que el contratista  conozca en razón de su contrato, análisis de mercado y del consumidor, actividades promocionales, de investigación y creación de nuevos productos, creación de comunidades de clientes o personas con fines comerciales o de mercadeo y cantidades de producción. '}
          <B>{'La obligación de la reserva del contratista (a) será permanente salvo que el contratante haga pública dicha información.'}</B>
        </Text>
        <Cl
          title="CESIÓN DE USO DE IMAGEN:"
          body={'En caso que el (a) Contratista (a) aparezca en fotografías, videos, grabaciones, reproducciones, entre otras, con fines publicitarios, con relación y en la ejecución del presente contrato, respecto de los productos y servicios que se comercializan en la FUNDACION NUEVO HORIZONTE, el Contratista (a) cede su derecho de uso de imagen al contratante; la cesión comprende la divulgación de obra fotográfica, derecho de reproducción, derecho de distribución, derecho de explotación comercial, derecho de comunicación pública, derecho de transformación a favor de la Fundación  y sus representantes, de forma exclusiva y a título universal.'}
        />
        <Cl
          title="RESPONSABILIDADES SISTEMA DE GESTIÓN DE LA SEGURIDAD Y SALUD EN EL TRABAJO (SG-SST):"
          body={'El Contratista se obliga a cumplir estrictamente las responsabilidades contenidas en el artículo 10 del Decreto 1443 de 2014- Sistema de Gestión de la Seguridad y Salud en el Trabajo (SG-SST).'}
        />
        <Cl
          title="RESPONSABILIDADES PLAN ESTRATÉGICO DE SEGURIDAD VIAL (PESV):"
          body={'El (la) Contratista (a) se obliga a cumplir estrictamente las responsabilidades contenidas en el Plan Estratégico y la Política de Seguridad Vial de la Fundación, siguiendo la reglamentación establecida en la Ley 769 de 2002, Código Nacional de Tránsito Terrestre.'}
        />
        <Cl
          title="OBLIGACIONES DE LA FUNDACION NUEVO HORIZONTE:"
          body={'LA FUNDACION se obliga a facilitar a LA CONTRATISTA todos los bienes muebles o inmuebles, enseres, información y demás elementos necesarios para el cumplimiento de sus obligaciones y a pagar oportunamente la contraprestación.'}
        />
        <Cl
          title="SEXTA. - PERFECCIONAMIENTO Y EJECUCIÓN:"
          body={'El presente contrato se entenderá perfeccionado una vez haya sido suscrito por las partes. Igualmente, EL CONTRATISTA deberá presentar todos los documentos necesarios para la legalización del contrato dentro de los cinco (5) días calendario siguientes al recibo de la comunicación que contenga la exigencia en dicha materia, so pena de incurrir en incumplimiento de las obligaciones pactadas y se proceda a declarar la terminación unilateral.'}
        />
        <Cl
          title="SÉPTIMA. - CONTROL Y VIGILANCIA:"
          body={'La Vigilancia de este contrato estará a cargo del Representante Legal de la Fundación Nuevo Horizonte, o quien haga sus veces, quien velará por el estricto cumplimiento del objeto del contrato. En desarrollo de la labor de vigilancia el supervisor tendrá las siguientes funciones: a) Verificar las actividades que debe desarrollar EL CONTRATISTA en desarrollo del objeto contratado; b) Verificar la afiliación y pago oportuno de EL CONTRATISTA de sus obligaciones con el sistema general de seguridad social integral; c) Estudiar las sugerencias, reclamaciones y consultas de EL CONTRATISTA sobre los aspectos relacionados con la ejecución del contrato, resolver las que sean de su competencia y dar traslado de las que no le competen al competente; d) Revisar informes mensuales y generar el paz y salvo al finalizar el periodo del contrato.'}
        />
        <Cl
          title="OCTAVA. - TERMINACIÓN DEL CONTRATO:"
          body={'El presente contrato podrá darse por terminado, en cualquiera de los siguientes casos: 1. Por mutuo acuerdo de las partes; 2. Por incumplimiento de las obligaciones a cargo de EL CONTRATISTA; 3. Por vencimiento de su plazo. 4. Por fuerza mayor o caso fortuito que imposibilite la ejecución de este contrato.'}
        />
        <Para label="PARÁGRAFO: TERMINACIÓN ANTICIPADA DEL CONTRATO:" body={'Cualquiera de las partes podrá dar por terminado el contrato, en cualquier momento previo aviso verbal o escrito a la otra parte, con quince días de anticipación.'} />
        <Cl
          title="NOVENA. -CLÁUSULA PENAL PECUNIARIA:"
          body={'Parar efectos de cumplimiento de las obligaciones derivadas del presente contrato las partes de común acuerdo pactan una cláusula penal equivalente al 30% del valor total del contrato, la cual se liquidará y pagará por la parte incumplida a favor de la parte cumplida.'}
        />
        <Text style={S.body}>
          <B>{'DÉCIMA. - CESION DEL CONTRATO:'}</B>
          {' EL CONTRATISTA no podrá ceder el presente contrato, sin la previa autorización expresa y escrita de LA FUNDACION. '}
          <B>{'DÉCIMA PRIMERA. - RELACIONES LABORALES:'}</B>
          {' EL CONTRATISTA, se obliga a título de contratista independiente; LA FUNDACION en consecuencia no adquiere ningún vínculo de carácter laboral o administrativo, con él, ni con las personas que ocupa o llegare a ocupar. Dada la naturaleza del contrato, es entendido que no surge relación de empleo, y que por tanto la remuneración se limita a la suma pactada sin que haya lugar a pago alguno por concepto de prestaciones sociales. Si hubiere lugar a contratar personal auxiliar, él correrá completamente a cargo de EL CONTRATISTA y no surgirá relación alguna con LA FUNDACION. '}
          <B>{'DÉCIMA SEGUNDA. - IMPUTACIÓN DE GASTOS:'}</B>
          {' Los gastos que demande la legalización del presente contrato, correrán a cargo de EL CONTRATISTA, y los que implique para LA FUNDACION el cumplimiento del mismo, se harán con cargo del presupuesto de la misma. '}
          <B>{'DÉCIMA TERCERA. - APORTES A LA SEGURIDAD SOCIAL.'}</B>
          {' De conformidad con lo dispuesto en la Ley 100 de 1993, y Decreto Nacional 2353 de 2015, EL CONTRATISTA deberá acreditar el pago de la seguridad social integral (salud, pensión y ARL) de manera independiente. '}
          <B>{'DÉCIMA CUARTA. - LIQUIDACIÓN.'}</B>
          {' El presente contrato se liquidará de común acuerdo o unilateralmente por parte de LA FUNDACION dentro del mes siguiente a su terminación. '}
          <B>{'DÉCIMA QUINTA. -DOMICILIO CONTRACTUAL:'}</B>
          {' Para efectos de la ejecución del presente contrato, el domicilio contractual será el Municipio de Guadalajara de Buga (V). '}
          <B>{'DÉCIMA SEXTA. - CAPACIDAD E IDONEIDAD.'}</B>
          {' Para todos los efectos, este contrato se celebra en consideración que EL CONTRATISTA demostró su capacidad, idoneidad y experiencia para ejecutar el presente contrato, a través de los documentos que se anexan y forman parte integrante del mismo. '}
          <B>{'DÉCIMA SEPTIMA. -ELEMENTOS DEL CONTRATO:'}</B>
          {' Para todos los efectos legales se entienden incorporados al presente contrato los siguientes documentos, si da lugar a ello: 1) Registro actualizado del RUT; 2) Pagos de seguridad social y afiliación a Riesgos Profesionales; 3) Constancia de verificación en el Boletín de Responsables Fiscales y antecedentes disciplinarios. 4) Hoja de vida con soportes.'}
        </Text>
        <Text style={S.body}>
          {'Para constancia se firma en dos (2) ejemplares del mismo tenor y valor, ante testigos en '}{v.lugar_trabajo}{' del Cauca, a los '}{v.dia_inicio}{' días del mes de '}{v.mes_inicio}{' del año '}{v.anio_inicio}{'.'}
        </Text>
        <View style={S.sigRow}>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>{'EL CONTRATANTE'}</Text>
            <Text style={{ height: 40 }} />
            <Text style={S.sigName}>{'DORA PATRICIA CARMONA SOTO'}</Text>
            <Text style={S.sigLine}>{'C.C. 29.158.068'}</Text>
            <Text style={S.sigLine}>{'Representante Legal'}</Text>
            <Text style={S.sigLine}>{'Fundación Nuevo Horizonte.'}</Text>
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>{'EL CONTRATISTA'}</Text>
            <SigSpace firma={v.firma} />
            <Text style={S.sigName}>{v.trabajador_nombre}</Text>
            <Text style={S.sigLine}>{'C.C. '}{v.trabajador_cedula}</Text>
            <Text style={S.sigLine}>{'Tel: '}{v.trabajador_telefono}</Text>
          </View>
        </View>
      </Page>
      {/* Blank separator page */}
      <Page style={S.page}>
        <PageHeader />
        <PageFooter />
      </Page>
      {/* Appendices */}
      <Page style={S.page}>
        <PageHeader />
        <PageFooter />
        <AppendixAutorizacionImagenes v={v} />
        <AppendixDatosPersonales v={v} />
        <AppendixConfidencialidad v={v} />
      </Page>
      {/* Preaviso */}
      <AppendixPreaviso v={v} />
    </Document>
  )
}

// ── Otro Sí ─────────────────────────────────────────────────────────────────

function OtroSi({ v }: { v: ContractVars }) {
  const jornadaLabel = v.trabajador_jornada ?? 'JORNADA COMPLETA'
  const mesUpper = (v.mes_inicio ?? '').toUpperCase()

  const fullWidthBold = {
    fontFamily: 'Times-Bold' as const,
    fontSize: 9,
    borderRight: '1pt solid #000' as const,
    paddingHorizontal: 4,
    paddingVertical: 3,
    flex: 1,
  }

  return (
    <Document>
      <Page style={S.page}>
        <PageHeader />
        <PageFooter />

        <View style={S.table}>
          <View style={S.tableRow}>
            <Text style={fullWidthBold}>
              {'OTRO SI AL CONTRATO LABORAL A TÉRMINO FIJO INFERIOR A UN AÑO – '}{jornadaLabel}
            </Text>
          </View>
          <View style={S.tableRow}>
          <Text style={{ ...fullWidthBold, textAlign: 'center' }}>
            {'N°. '}{v.contrato_numero}
          </Text>
        </View>
        <TR label="NOMBRE EMPLEADOR:" value="FUNDACIÓN NUEVO HORIZONTE NIT: 821.003.251-4" />
        <TR label="NOMBRE TRABAJADOR:" value={`${v.trabajador_nombre}  C. C. No. ${v.trabajador_cedula}`} />
        <TR label="CARGO:" value={v.trabajador_cargo} />
        <TR label="FECHA:" value="16 DE MARZO DEL AÑO 2026" />
      </View>

      <Text style={S.body}>
        {'Entre los suscritos, a saber '}
          <B>{'DORA PATRICIA CARMONA SOTO'}</B>
          {', mayor de edad, identificada con la cédula de ciudadanía '}
          <B>{'N° 29.158.068 expedida en Ansermanuevo (Valle del Cauca)'}</B>
          {', en su calidad de Representante Legal de la '}
          <B>{'FUNDACION NUEVO HORIZONTE NIT 821.003.251-4'}</B>
          {' y con domicilio principal en la ciudad de Guadalajara de Buga, quien para efectos del presente documento se denominará el '}
          <B>{'EMPLEADOR'}</B>
          {', y por otra parte, '}
          <B>{v.trabajador_nombre}</B>
          {', también mayor de edad, identificada/o con la cédula de ciudadanía '}
          <B>{`N° ${v.trabajador_cedula}`}</B>
          {', quien se denominará el '}
          <B>{'TRABAJADOR'}</B>
          {', hemos acordado Por mutuo acuerdo de manera libre y voluntaria suscribir el presente '}
          <B>{'OTROSÍ'}</B>
          {' para modificar la forma de pago; bajo las siguientes consideraciones:'}
        </Text>

        <Text style={S.body}>
          <B>{'PRIMERA. FORMA DE PAGO'}</B>
          {': Las partes acuerdan modificar '}
          <B>{'LA FORMA DE PAGO'}</B>
          {' del contrato de trabajo vigente. A partir de la firma del presente documento, el pago del salario mensual se realizará dentro del periodo comprendido entre los días '}
          <B>{'quince (15) y veinte (20)  de cada mes calendario.'}</B>
        </Text>

        <Text style={S.body}>
          {'El presente '}
          <B>{'OTROSÍ'}</B>
          {' rige a partir de la fecha de su firma y las demás cláusulas del contrato de trabajo original que no fueron modificadas, ni nombradas por este documento permanecen vigentes y sin cambio alguno.'}
        </Text>

        <Text style={S.body}>
          {'Para constancia de lo anterior, se firma en dos (2) ejemplares del mismo tenor y valor, ante testigos en Guadalajara de Buga – Valle del Cauca a los dieciséis días del mes de MARZO de 2026.'}
        </Text>

        <View style={S.sigRow}>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>{'EL EMPLEADOR'}</Text>
            <Text style={{ height: 40 }} />
            <Text style={S.sigName}>{'DORA PATRICIA CARMONA SOTO'}</Text>
            <Text style={S.sigLine}>{'C.C. No. 29.158.068 de Ansermanuevo'}</Text>
            <Text style={S.sigLine}>{'Representante Legal'}</Text>
          </View>
          <View style={S.sigCol}>
            <Text style={S.sigLabel}>{'EL TRABAJADOR'}</Text>
            <SigSpace firma={v.firma} />
            <Text style={S.sigName}>{v.trabajador_nombre}</Text>
            <Text style={S.sigLine}>{`C.C. No. ${v.trabajador_cedula}`}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

// ── Public export ───────────────────────────────────────────────────────────

export async function generateContractPdf(vars: ContractVars, tipo: string): Promise<Blob> {
  let doc: React.ReactElement<DocumentProps>

  if (tipo === 'tiempo_completo') {
    doc = <ContratoLaboral v={vars} titulo="A TÉRMINO FIJO INFERIOR A UN AÑO" octavaBody={OCTAVA_COMPLETO} />
  } else if (tipo === 'medio_tiempo') {
    doc = <ContratoLaboral v={vars} titulo="A TÉRMINO FIJO INFERIOR A UN AÑO DE TIEMPO PARCIAL" octavaBody={OCTAVA_PARCIAL} />
  } else if (tipo === 'otro_si') {
    doc = <OtroSi v={vars} />
  } else {
    doc = <ContratoPrestacionServicios v={vars} />
  }

  return pdf(doc).toBlob()
}
