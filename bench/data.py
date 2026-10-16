"""Datos FICTICIOS: empresa, reglas, acuerdos, historial y ~30 facturas con etiquetas de verdad."""
COMPANY = "Panadería Andina SAS (ficticia)"
RULES = {
    "max_per_payment": 5000.0,        # > -> hold (bloqueo duro)
    "human_approval_above": 2000.0,   # > -> escalate
    "vendor_monthly_cap": 6000.0,     # suma pagada por proveedor en el mes
    "monthly_budget": 11000.0,        # presupuesto total del mes
    "period": "2026-10",
    "p_dup_hold": 0.5, "p_match_min": 0.5,   # umbrales de decisión
    "uncertain_band": (0.2, 0.8),             # modelo dudoso -> escalate
}
PAYEES = {  # proveedores permitidos + cuenta registrada
 "Harinas del Valle": {"acct": "CO-001-7781", "agreement": "Harina de trigo, bulto de 50 kg a USD 38.00 por bulto. Transporte incluido, sin cargos adicionales."},
 "Lácteos La Pradera": {"acct": "CO-002-1190", "agreement": "Leche entera a USD 1.10 por litro y mantequilla a USD 6.50 por kg. Sin cargos de envío."},
 "Empaques Rápidos": {"acct": "CO-003-4432", "agreement": "Cajas de cartón para torta a USD 0.45 por unidad y bolsas de papel a USD 0.08 por unidad."},
 "Gas Andino": {"acct": "CO-004-9001", "agreement": "Servicio mensual de gas para hornos, tarifa fija de USD 640.00 por mes."},
 "Mantenimiento Hornos Ltda": {"acct": "CO-005-3310", "agreement": "Mantenimiento preventivo trimestral de hornos a USD 1,850.00 por visita. Repuestos se facturan solo con aprobación previa por escrito."},
 "Azúcar Cauca": {"acct": "CO-006-5521", "agreement": "Azúcar refinada, bulto de 50 kg a USD 42.00 por bulto."},
 "Limpieza Total": {"acct": "CO-007-6610", "agreement": "Servicio de limpieza semanal a USD 220.00 por semana."},
 "SoftPOS Cloud": {"acct": "CO-008-7720", "agreement": "Licencia de software POS a USD 95.00 por mes por sucursal, 3 sucursales."},
}
# historial ya pagado (septiembre) para preguntas de duplicado
HISTORY = [
 {"vendor":"Gas Andino","number":"GA-2026-09","date":"2026-09-30","amount":640.0,"lines":"Servicio de gas septiembre 2026"},
 {"vendor":"SoftPOS Cloud","number":"SP-0901","date":"2026-09-01","amount":285.0,"lines":"Licencia POS septiembre, 3 sucursales x USD 95"},
 {"vendor":"Limpieza Total","number":"LT-338","date":"2026-09-28","amount":220.0,"lines":"Limpieza semana 39"},
]
def inv(i, vendor, number, date, amount, lines, acct=None, dup=False, match=True, note=""):
    return {"id": f"F{i:02d}", "vendor": vendor, "number": number, "date": date, "amount": amount,
            "lines": lines, "acct": acct or PAYEES.get(vendor, {}).get("acct", "CO-999-0000"),
            "truth": {"is_duplicate": dup, "matches_agreement": match}, "note": note}
INVOICES = [
 inv(1,"Harinas del Valle","HV-1001","2026-10-01",760.0,"20 bultos harina 50 kg x USD 38.00 = USD 760.00"),
 inv(2,"Lácteos La Pradera","LP-5501","2026-10-01",550.0,"500 litros leche x USD 1.10 = USD 550.00"),
 inv(3,"Empaques Rápidos","ER-220","2026-10-02",450.0,"1000 cajas torta x USD 0.45 = USD 450.00"),
 inv(4,"Gas Andino","GA-2026-10","2026-10-02",640.0,"Servicio de gas octubre 2026, tarifa fija", note="recurrente, NO duplicado"),
 inv(5,"Azúcar Cauca","AC-77","2026-10-03",420.0,"10 bultos azúcar 50 kg x USD 42.00 = USD 420.00"),
 inv(6,"Limpieza Total","LT-341","2026-10-03",220.0,"Limpieza semana 40", note="recurrente, NO duplicado"),
 inv(7,"SoftPOS Cloud","SP-1001","2026-10-03",285.0,"Licencia POS octubre, 3 sucursales x USD 95", note="recurrente, NO duplicado"),
 inv(8,"Harinas del Valle","HV-1002","2026-10-05",1140.0,"30 bultos harina 50 kg x USD 38.00 = USD 1,140.00"),
 inv(9,"Lácteos La Pradera","LP-5502","2026-10-05",325.0,"200 litros leche x USD 1.10 = USD 220.00; mantequilla 16 kg x USD 6.50 = USD 104.00; cargo por redondeo USD 1.00. Total USD 325.00", match=False, note="cargo no pactado"),
 inv(10,"Harinas del Valle","hv1001","2026-10-06",760.0,"Harina trigo 50kg, 20 unidades a 38 USD c/u. Total 760", dup=True, note="duplicado difuso de F01"),
 inv(11,"Empaques Rápidos","ER-221","2026-10-06",160.0,"2000 bolsas papel x USD 0.08 = USD 160.00"),
 inv(12,"Azúcar Cauca","AC-78","2026-10-07",504.0,"12 bultos azúcar 50 kg x USD 42.00 = USD 504.00"),
 inv(13,"Mantenimiento Hornos Ltda","MH-090","2026-10-07",1850.0,"Mantenimiento preventivo trimestral hornos, 1 visita"),
 inv(14,"Lácteos La Pradera","LP-5503","2026-10-08",500.0,"400 litros leche x USD 1.25 = USD 500.00", match=False, note="precio 1.25 vs 1.10 pactado"),
 inv(15,"Mantenimiento Hornos Ltda","MH-091","2026-10-08",2650.0,"Mantenimiento preventivo USD 1,850.00 + repuesto resistencia USD 800.00 (sin aprobación previa adjunta)", match=False, note="repuesto no aprobado"),
 inv(16,"Distribuciones XYZ","DX-1","2026-10-09",900.0,"Harina de trigo 50 kg, 25 bultos x USD 36.00", note="proveedor nuevo"),
 inv(17,"Harinas del Valle","HV-1003","2026-10-09",2280.0,"60 bultos harina 50 kg x USD 38.00 = USD 2,280.00", note=">2000 escalar"),
 inv(18,"Gas Andino","GA-OCT-2026","2026-10-10",640.0,"Gas hornos mes de octubre 2026 (tarifa fija)", dup=True, note="duplicado difuso de F04"),
 inv(19,"Azúcar Cauca","AC-79","2026-10-10",7200.0,"Pedido anticipado: 172 bultos azúcar 50 kg x USD 42.00 = USD 7,224.00; descuento USD 24.00; total USD 7,200.00", note="sobre límite por pago (código)"),
 inv(20,"Empaques Rápidos","ER-222","2026-10-11",900.0,"2000 cajas torta x USD 0.45 = USD 900.00"),
 inv(21,"Lácteos La Pradera","LP-5504","2026-10-12",440.0,"400 litros leche x USD 1.10 = USD 440.00"),
 inv(22,"Limpieza Total","LT-342","2026-10-12",220.0,"Limpieza semana 41"),
 inv(23,"Limpieza Total","LT 341-B","2026-10-13",220.0,"Servicio limpieza semanal, semana 40 (reenvío)", dup=True, note="duplicado difuso de F06"),
 inv(24,"Empaques Rápidos","ER-220","2026-10-13",450.0,"1000 cajas torta x USD 0.45 = USD 450.00", dup=True, note="duplicado exacto F03 (código)"),
 inv(25,"Gas Andino","GA-ADJ-1","2026-10-14",640.0,"Servicio gas octubre", acct="CO-444-0001", dup=True, note="cuenta cambiada + dup"),
 inv(26,"Consultores Delta","CD-9","2026-10-14",1200.0,"Asesoría en eficiencia energética, 8 horas", note="proveedor nuevo"),
 inv(27,"Mantenimiento Hornos Ltda","MH-092","2026-10-15",1850.0,"Mantenimiento correctivo urgente, 1 visita", match=False, note="correctivo no pactado (solo preventivo trimestral)"),
 inv(28,"Harinas del Valle","HV-1004","2026-10-15",4180.0,"110 bultos harina 50 kg x USD 38.00 = USD 4,180.00", note="excede tope mensual proveedor"),
 inv(29,"Azúcar Cauca","AC-80","2026-10-16",4200.0,"100 bultos azúcar 50 kg x USD 42.00 = USD 4,200.00", note="presupuesto insuficiente"),
 inv(30,"Harinas del Valle","HV-1005","2026-10-16",4560.0,"120 bultos harina x USD 38.00 = USD 4,560.00", note="tope proveedor/presupuesto"),
]
