# Invoice formats: research notes and how Clearhold generates them

Clearhold's demo set has to look like what a US company's AP team (Northwind Ridge Inc.) actually gets from LATAM contractors. These notes cover what real invoices in each country contain, and how `src/gen/invoice.mjs` reproduces it. **Every value in the generated documents is fictional**: `.example` domains, `XX-FAKE-…` accounts, tax ids made of zeros, and "Banco Ficticio" banks. Every page carries the footer *"Synthetic sample document — fictional company and data (Clearhold demo)"*.

## What every real invoice has (generic anatomy)

From SMB/SaaS guidance (Xero, PayPal, Stripe) and common templates (Microsoft Excel/Vertex42, FreshBooks-style):

- **Header**: the word *Invoice / Factura / Fatura*, the vendor's legal name, tax id, address and contact details, often next to a logo.
- **Bill to**: the customer's legal name, tax id and address.
- **Identifiers**: a unique invoice number, issue date, due date (or terms such as "Net 30"), and often the customer's PO number.
- **Line items**: description, quantity/hours, unit, unit price and line amount.
- **Totals**: subtotal, then discounts, taxes (rate + amount), withholdings and fees, then **total / amount due / balance due**. When something was paid already, they also show the amount paid and the remaining balance.
- **Payment instructions**: bank, account holder, account/IBAN/CLABE, SWIFT/BIC, and "use the invoice number as reference".
- **Notes / terms**: payment terms, late fees and thanks. Spanish/Portuguese invoices commonly also print the **total in words** ("SON: …", "Valor por extenso").
- **Vendor emails** are short. Subject "Invoice #N from Vendor — due DATE", a greeting, "please find attached…", the amount and due date, a sign-off and a signature, with the PDF attached and named after the invoice number.

Sources:
- Xero, *What to include on an invoice*: https://www.xero.com/us/guides/what-to-include-on-invoice/
- PayPal, *What to include in an invoice*: https://www.paypal.com/us/brc/article/what-to-include-in-invoice
- Stripe, *How to generate an invoice*: https://stripe.com/resources/more/creating-an-invoice-explained · Invoice object (`amount_due`, `due_date`): https://docs.stripe.com/api/invoices/object
- Microsoft Excel invoice templates (spreadsheet look, exported to PDF): https://excel.cloud.microsoft/create/en/invoice-templates/
- Vertex42 service invoice template: https://www.vertex42.com/ExcelTemplates/service-invoice-template.html
- HubSpot service invoice template: https://www.hubspot.com/resources/templates/service-invoice
- Invoice email examples: https://www.highradius.com/resources/Blog/how-to-write-invoice-email-template/ · https://cmdk.email/post/invoice-email-templates/

## Country formats (contractor → US client = export of services)

Every curated vendor bills a US company for services used abroad, so in each country the realistic tax treatment is **0% / not levied, with the legal basis printed on the invoice**. That keeps total = subtotal = contracted amount, so the trap semantics don't change. The extractor is still tested on invoices where taxes and withholdings make the total differ from the subtotal (`test/extract.test.mjs`).

| Style | Country | What the real document looks like | Fictional stand-ins we print | Sources |
|---|---|---|---|---|
| `dian` | Colombia | The *representación gráfica* of the electronic sales invoice: "FACTURA ELECTRÓNICA DE VENTA", prefix + number, DIAN numbering resolution, issue date/time, payment form/method, buyer data, item lines, totals, CUFE and a QR code on every page. The XML is the legal invoice; the PDF must not contradict it. Exports of services are IVA-exempt (E.T. art. 481 lit. c), with the exporter registered in the RUT. | NIT 000.000.101-1, fake resolution "No. 00000000000001 (ficticia)", fake CUFE, drawn pseudo-QR, "IVA exento — exportación de servicios (Art. 481 lit. c E.T.)", total in words "SON: …" | DIAN Res. 000042/2020 https://www.dian.gov.co/normatividad/Normatividad/Resoluci%C3%B3n%20000042%20de%2005-05-2020.pdf · normograma https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0042_2020.htm · Concepto 4232/2024 https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_4232_2024.htm · Concepto 5846/2024 https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_5846_2024.htm · E.T. art. 481 https://estatuto.co/481 · reference layouts https://felcowiki.thefactoryhka.com.co/index.php/Modelos_de_referencia_de_representaciones_gr%C3%A1ficas_de_factura_electr%C3%B3nica_(impresi%C3%B3n_tirilla_POS_y_tama%C3%B1o_carta) |
| `cfdi` | Mexico | The printed CFDI 4.0: issuer RFC and tax regime, receiver; a foreign customer uses the generic RFC **XEXX010101000** with regime 616 / use S01. Folio, UUID (fiscal folio), certificate numbers, Exportación "01 No aplica" for services, IVA at rate **0%** (LIVA art. 29), digital stamps and the "cadena original". | RFC PNO000000FK1, XEXX010101000, fake UUID / stamps / PAC "PAC000000FK0", ClaveProdServ/ClaveUnidad (HUR, E48), "IVA 0% (exportación de servicios, art. 29 LIVA)" | SAT LIVA art. 29 https://wwwmat.sat.gob.mx/articulo/80321/articulo-29 · generic-RFC guide https://conocimiento.blob.core.windows.net/conocimiento/Manuales/Reforma_Fiscal_2022/RFC_Generico/facturacion_con_rfc_generico.htm · https://www.heru.app/facturacion/extranjeros/ |
| `nfse` | Brazil | The DANFSe (auxiliary document of the national NFS-e): number, issue date/time, verification code, provider/taker blocks, service description, service code, ISS details, net value ("Valor líquido"), access key/QR. ISS is **not levied on service exports** (LC 116/2003 art. 2 I). | CNPJ 00.000.003/0001-03, fake access key and verification code, "ISS não incide — exportação (LC 116/2003, art. 2º, I)", "Valor líquido da nota" | NT SE/CGNFS-e 008 (DANFSe) https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc/nt-008-se-cgnfse-danfse-20260714-v1-02.pdf · NFS-e documentation https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica · LC 116/2003 https://www.planalto.gov.br/ccivil%5F03/leis/lcp/lcp116.htm |
| `sunat` | Peru | Electronic invoice with the RUC box ("FACTURA ELECTRÓNICA", series-number), the customer as a non-domiciled person without RUC, operation type **0201 Exportación de servicios**, IGV 0% (affectation 40), "Importe total", total in words, hash and QR. | RUC 00000000404, fake hash, "Exportación de servicios — IGV no gravado", "SON: …" | SUNAT invoice guidance https://orientacion.sunat.gob.pe/02-factura · exports https://orientacion.sunat.gob.pe/11-exportacion-de-bienes-y-servicios · catalogue annex https://www.sunat.gob.pe/legislacion/superin/2023/anexo-000005-2023.pdf |
| `sii` | Chile | A qualified service export is invoiced on the **Factura de Exportación Electrónica (DTE 110)**, not a "factura exenta". It shows the red-bordered RUT box with the document number and SII office, receptor data, items, "Monto exento/total", and the electronic stamp (PDF417 "Timbre Electrónico SII"). | RUT 00.000.707-K, fake folio, drawn pseudo-barcode stamp | SII FAQ https://www.sii.cl/preguntas_frecuentes/factura_electronica/001_003_6293.htm · https://www.sii.cl/preguntas_frecuentes/factura_electronica/001_003_3434.htm · service-exporter portal https://www.sii.cl/destacados/exportador_servicios/ |
| `modern` | any | A SaaS-generated invoice (Stripe / Xero / QuickBooks look): accent bar, logo block, an "AMOUNT due on DATE" headline, clean table, payment block. | — | Stripe, Xero links above |
| `freelance` | US/EN | A one-person contractor invoice from a word-processor template: personal name, "Bill to", hours table, "Balance due". | — | Xero, PayPal links above |
| `spreadsheet` | any | A spreadsheet exported to PDF: gridlines, column letters/row numbers, bold header row, "Sheet1" page footer, values in cells. | — | Microsoft Excel templates, Vertex42 |

Some invoices run to **two pages**: hourly work comes with a timesheet annex, and others carry a terms page, with "Page 1 of 2" page numbering. The photo variants (WhatsApp channel) render page 1 of an invoice PDF, then add paper tone, perspective, a slight rotation, blur and grain, and save a JPEG (`scripts/render_images.py`).

## Extraction rules that follow from this (`src/extract/text.mjs`)

- PDF text is rebuilt **layout-aware**: positioned text items are grouped into lines by baseline, and column gaps become tabs. Table rows therefore stay rows, and label/value pairs stay on one line.
- **Amount = total due**:
  - Labels are ranked strong (*total a pagar, total due, amount due, balance due, valor líquido, importe total…*), weak (*total, valor total, monto*) or excluded (*subtotal, IVA/IGV/ISS/tax, retención/withholding, descuento, total in words, per-page totals…*).
  - Two different values at the same rank make the amount **unknown**. The invoice then escalates; Clearhold never picks one.
- **Currency** comes from the total line, or else from a "Moneda/Currency/Moeda: XXX" label. A bare `$` with no label stays ambiguous, and so does a label that contradicts the total. In both cases the invoice escalates.
- **Vendor**: explicit labels, then cells of the letterhead (exact registry match only, so a lookalike such as "Andes Dev Studi0 SAS" never resolves to the real vendor), then the name before the first non-customer tax id, then the email display name.
- **Invoice number**: labelled fields, then a number box under the title (DIAN/SUNAT/SII layouts), then OCR-tolerant forms and the payment reference. Bank accounts, PO numbers and dates are never accepted as the number.
- **Line items**: the table header is detected, then rows parse as a *qty × unit price = amount* triple. Descriptions are canonical (the "40 horas x 180.000" clause is removed), so the same invoice sent by email, PDF and photo gets the same fingerprint. That is what makes the cross-channel duplicate traps work.
- Evidence spans still point at the exact text in the document. Quotes stay in the document's original language.

## Example files

- Curated PDFs: `data/curated/C03.pdf` (NFS-e), `C12.pdf` (DIAN, lookalike vendor), `C15.pdf` (SII), `C20.pdf` (freelance), `C23.pdf` (spreadsheet, 2 pages), `C25.pdf` (SUNAT)
- Email attachments: `C01.att.pdf` (DIAN, 2 pages with timesheet), `C02.att.pdf` (CFDI), `C07.att.pdf` (SII, 2 pages), `C16.att.pdf` (spreadsheet, with the bank-change notice), `C27.att.pdf` (modern)
- Photos: `C04.jpg`, `C08.jpg` (spreadsheet), `C14.jpg`, `C22.jpg`
- Regenerate them with `node scripts/build-dataset.mjs && python3 scripts/render_images.py data/curated data/stress-s1`, then `npm run build` to rebuild the mock-inbox seed.
