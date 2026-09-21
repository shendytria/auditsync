import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const BORDER_COLOR = '#000000';
const CELL_PADDING = 2;

const tableBorderTopLeft = {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: BORDER_COLOR,
};

const cellBorderBottomRight = {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: BORDER_COLOR,
    padding: CELL_PADDING,
};

const styles = StyleSheet.create({
    page: { 
        padding: 20, 
        fontSize: 6,
        fontFamily: 'Helvetica',
        paddingBottom: 40 
    },
    
    headerContainer: { 
        flexDirection: 'row', 
        marginBottom: 10,
        height: 100 
    },
    headerLeft: { 
        width: '25%', 
        marginRight: 5,
        justifyContent: 'space-between'
    },
    logoBox: {
        height: 40,
        justifyContent: 'center',
    },
    logoImage: {
        width: 100, 
        height: 'auto'
    },
    checksheetBox: {
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    checksheetTitle: {
        backgroundColor: '#f0f0f0',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 7,
        padding: 2,
        borderBottomWidth: 1,
        borderBottomColor: BORDER_COLOR
    },
    areaNameBox: {
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 9,
        padding: 4,
    },

    headerRight: { 
        flex: 1,
        justifyContent: 'space-between'
    },
    mainTitleBox: {
        borderWidth: 1,
        borderColor: BORDER_COLOR,
        padding: 5,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 5
    },
    mainTitleText: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    
    subHeaderContainer: {
        flexDirection: 'row',
        flex: 1
    },
    
    infoTable: {
        width: '28%',
        marginRight: 8,
        ...tableBorderTopLeft 
    },
    infoRow: { flexDirection: 'row', flex: 1 },
    infoLabel: { width: 50, backgroundColor: '#f0f0f0', ...cellBorderBottomRight, justifyContent: 'center' },
    infoValue: { flex: 1, fontWeight: 'bold', ...cellBorderBottomRight, justifyContent: 'center' },

    approvalTable: {
        flex: 1,
        ...tableBorderTopLeft
    },
    approvalRow: { flexDirection: 'row' },
    appColHeader: { 
        flex: 1,
        ...cellBorderBottomRight,
        backgroundColor: '#f0f0f0',
        textAlign: 'center',
        fontWeight: 'bold'
    },
    appColLabel: { 
        width: '20%', 
        backgroundColor: '#f0f0f0', 
        ...cellBorderBottomRight,
        justifyContent: 'center'
    },
    appColSign: { 
        flex: 1,
        ...cellBorderBottomRight, 
        textAlign: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 20 
    },
    
    approvalStamp: {
        width: 30, 
        height: 'auto',
    },

    // --- MAIN DATA TABLE ---
    dataTable: {
        marginTop: 5,
        ...tableBorderTopLeft
    },
    tableRow: { flexDirection: 'row' },
    headerCell: {
        backgroundColor: '#f0f0f0',
        fontWeight: 'bold',
        textAlign: 'center',
        justifyContent: 'center',
        ...cellBorderBottomRight
    },
    dataCell: {
        textAlign: 'left',
        ...cellBorderBottomRight
    },
    centerCell: {
        textAlign: 'center',
        justifyContent: 'center',
        ...cellBorderBottomRight
    },

    cNo:    { width: '3%' },
    cReq:   { width: '10%' },
    cKat:   { width: '6%' },
    cDI:    { width: '6%' },
    c5R:    { width: '5%' },
    cRef:   { width: '8%' },
    cDesc:  { width: '14%' },
    cFoto:  { width: '8%' },
    cLok:   { width: '8%' },
    cRoot:  { width: '10%' },
    cPIC:   { width: '6%' },
    cAct:   { width: '10%' },
    cDue:   { width: '6%' },

    // Lebar Kolom Halaman 2 (Disesuaikan agar muat kolom baru)
    p2No:      { width: '3%' },
    p2Item:    { width: '10%' },
    p2Kat:     { width: '6%' },
    p2Desc:    { width: '12%' },
    p2PIC:     { width: '8%' },
    p2Act:     { width: '12%' },
    p2Due:     { width: '6%' },
    p2Bukti:   { width: '10%' },
    p2TglUp:   { width: '9%' },
    p2Verif:   { width: '8%' },
    p2TglVer:  { width: '8%' },
    p2Status:  { width: '8%' },
});

const Cell = ({ style, children }: { style?: any, children?: React.ReactNode }) => (
    <View style={[styles.dataCell, style]}>
        <Text>{children || ''}</Text>
    </View>
);

const CenterCell = ({ style, children }: { style?: any, children?: React.ReactNode }) => (
    <View style={[styles.centerCell, style]}>
        <Text>{children || ''}</Text>
    </View>
);

const HeaderCell = ({ style, children }: { style?: any, children?: React.ReactNode }) => (
    <View style={[styles.headerCell, style]}>
        <Text>{children || ''}</Text>
    </View>
);

export const AuditPdfDocument = ({ detail, items }: { detail: any, items: any[] }) => {
  const parseDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID') : '-';
  const getFirstImage = (evidence: any) => {
      if (Array.isArray(evidence) && evidence.length > 0) return evidence[0];
      if (typeof evidence === 'string' && evidence.trim() !== '') return evidence;
      return null;
  };
  
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const APPROVE_STAMP = "/label_approved.jpg";

  return (
    <Document>
      {/* PAGE 1: FULL APPROVAL */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
                <View style={styles.logoBox}><Image src="/logo.png" style={styles.logoImage} /></View>
                <View style={styles.checksheetBox}>
                    <Text style={styles.checksheetTitle}>Checksheet Audit Proses</Text>
                    <View style={styles.areaNameBox}><Text>{detail?.area}</Text></View>
                </View>
            </View>
            <View style={styles.headerRight}>
                <View style={styles.mainTitleBox}><Text style={styles.mainTitleText}>Laporan Temuan Audit Proses</Text></View>
                <View style={styles.subHeaderContainer}>
                    <View style={styles.infoTable}>
                        <View style={styles.infoRow}><View style={styles.infoLabel}><Text>Area</Text></View><View style={styles.infoValue}><Text>{detail?.area}</Text></View></View>
                        <View style={styles.infoRow}><View style={styles.infoLabel}><Text>Tgl Audit</Text></View><View style={styles.infoValue}><Text>{parseDate(detail?.tanggal_audit)}</Text></View></View>
                        <View style={styles.infoRow}><View style={styles.infoLabel}><Text>Auditor</Text></View><View style={styles.infoValue}><Text>{detail?.auditor}</Text></View></View>
                    </View>
                    <View style={styles.approvalTable}>
                        <View style={styles.approvalRow}>
                            <View style={styles.appColLabel} />
                            <View style={styles.appColHeader}><Text>Auditor</Text></View>
                            <View style={styles.appColHeader}><Text>QS Supervisor</Text></View>
                            <View style={styles.appColHeader}><Text>Supervisor Area</Text></View>
                            <View style={styles.appColHeader}><Text>Manager Area</Text></View>
                            <View style={styles.appColHeader}><Text>QS Manager</Text></View>
                        </View>
                        <View style={styles.approvalRow}>
                            <View style={styles.appColLabel}><Text>Nama/Inisial</Text></View>
                            <View style={styles.appColSign}><Text>{detail?.auditor}</Text></View>
                            <View style={styles.appColSign}><Text>{detail?.nama_qs_spv}</Text></View>
                            <View style={styles.appColSign}><Text>{detail?.nama_pic_capa}</Text></View>
                            <View style={styles.appColSign}><Text>{detail?.nama_mgr_area}</Text></View>
                            <View style={styles.appColSign}><Text>{detail?.nama_mgr_qs}</Text></View>
                        </View>
                        <View style={[styles.approvalRow, { height: 30 }]}>
                            <View style={styles.appColLabel}><Text>Paraf</Text></View>
                            <View style={styles.appColSign}>{detail?.tanggal_audit && <Image src={APPROVE_STAMP} style={styles.approvalStamp} />}</View>
                            <View style={styles.appColSign}>{detail?.tgl_approve_qs_spv && <Image src={APPROVE_STAMP} style={styles.approvalStamp} />}</View>
                            <View style={styles.appColSign}>{detail?.tgl_submit_capa && <Image src={APPROVE_STAMP} style={styles.approvalStamp} />}</View>
                            <View style={styles.appColSign}>{detail?.tgl_approve_mgr_area && <Image src={APPROVE_STAMP} style={styles.approvalStamp} />}</View>
                            <View style={styles.appColSign}>{detail?.tgl_approve_mgr_qs && <Image src={APPROVE_STAMP} style={styles.approvalStamp} />}</View>
                        </View>
                        <View style={styles.approvalRow}>
                            <View style={styles.appColLabel}><Text>Tanggal</Text></View>
                            <View style={styles.appColSign}><Text>{parseDate(detail?.tanggal_audit)}</Text></View>
                            <View style={styles.appColSign}><Text>{parseDate(detail?.tgl_approve_qs_spv)}</Text></View>
                            <View style={styles.appColSign}><Text>{parseDate(detail?.tgl_submit_capa)}</Text></View>
                            <View style={styles.appColSign}><Text>{parseDate(detail?.tgl_approve_mgr_area)}</Text></View>
                            <View style={styles.appColSign}><Text>{parseDate(detail?.tgl_approve_mgr_qs)}</Text></View>
                        </View>
                    </View>
                </View>
            </View>
        </View>

        <View style={styles.dataTable}>
            <View style={styles.tableRow}>
                <HeaderCell style={styles.cNo}>No</HeaderCell>
                <HeaderCell style={styles.cReq}>Persyaratan</HeaderCell>
                <HeaderCell style={styles.cKat}>Kategori</HeaderCell>
                <HeaderCell style={styles.cDI}>Data Integrity</HeaderCell>
                <HeaderCell style={styles.c5R}>Prinsip 5R</HeaderCell>
                <HeaderCell style={styles.cRef}>Reference Doc</HeaderCell>
                <HeaderCell style={styles.cDesc}>Ketidaksesuaian</HeaderCell>
                <HeaderCell style={styles.cFoto}>Foto Temuan</HeaderCell>
                <HeaderCell style={styles.cLok}>Lokasi Temuan</HeaderCell>
                <HeaderCell style={styles.cRoot}>Penyebab (Root Cause)</HeaderCell>
                <HeaderCell style={styles.cPIC}>PIC</HeaderCell>
                <HeaderCell style={styles.cAct}>Tindakan Remedial</HeaderCell>
                <HeaderCell style={styles.cDue}>Due Date</HeaderCell>
            </View>
            {items.map((item, idx) => (
                <View key={idx} style={styles.tableRow} wrap={false}>
                    <CenterCell style={styles.cNo}>{idx + 1}</CenterCell>
                    <Cell style={styles.cReq}>{item.item_checklist_text}</Cell>
                    <CenterCell style={styles.cKat}>{item.kategori_temuan}</CenterCell>
                    <CenterCell style={styles.cDI}>{item.data_integrity}</CenterCell>
                    <CenterCell style={styles.c5R}>{item.prinsip_5r}</CenterCell>
                    <Cell style={styles.cRef}>{item.referensi_doc}</Cell>
                    <Cell style={styles.cDesc}>{item.deskripsi_temuan}</Cell>
                    <View style={[cellBorderBottomRight, styles.cFoto, { justifyContent: 'center', alignItems: 'center' }]}>
                        {getFirstImage(item.bukti_temuan) ? <Image src={getFirstImage(item.bukti_temuan).startsWith('http') ? getFirstImage(item.bukti_temuan) : `${API_BASE}/${getFirstImage(item.bukti_temuan).replace(/\\/g, '/')}`} style={{ width: '100%', height: 35, objectFit: 'contain' }} /> : <Text>-</Text>}
                    </View>
                    <Cell style={styles.cLok}>{item.lokasi_temuan}</Cell>
                    <Cell style={styles.cRoot}>{item.capa?.root_cause}</Cell>
                    <CenterCell style={styles.cPIC}>{item.nama_pic_capa}</CenterCell>
                    <Cell style={styles.cAct}>{item.capa?.corrective_action}</Cell>
                    <CenterCell style={styles.cDue}>{parseDate(item.capa?.due_date)}</CenterCell>
                </View>
            ))}
        </View>
      </Page>

      {/* PAGE 2: VERIFICATION & STATUS */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
                <View style={styles.logoBox}><Image src="/logo.png" style={styles.logoImage} /></View>
                <View style={styles.checksheetBox}>
                    <Text style={styles.checksheetTitle}>Verifikasi Temuan Audit</Text>
                    <View style={styles.areaNameBox}><Text>{detail?.area}</Text></View>
                </View>
            </View>
            <View style={styles.headerRight}>
                <View style={styles.mainTitleBox}><Text style={styles.mainTitleText}>Laporan Status & Verifikasi</Text></View>
                <View style={styles.subHeaderContainer}>
                    <View style={styles.infoTable}>
                        <View style={styles.infoRow}><View style={styles.infoLabel}><Text>Area</Text></View><View style={styles.infoValue}><Text>{detail?.area}</Text></View></View>
                        <View style={styles.infoRow}><View style={styles.infoLabel}><Text>Auditor</Text></View><View style={styles.infoValue}><Text>{detail?.auditor}</Text></View></View>
                    </View>
                    <View style={[styles.approvalTable, { flex: 0.6 }]}>
                        <View style={styles.approvalRow}>
                            <View style={styles.appColLabel} />
                            <View style={styles.appColHeader}><Text>QS Staff</Text></View>
                            <View style={styles.appColHeader}><Text>QS Supervisor</Text></View>
                        </View>
                        <View style={styles.approvalRow}>
                            <View style={styles.appColLabel}><Text>Nama/Inisial</Text></View>
                            <View style={styles.appColSign}><Text>{detail?.nama_qs_staff || '-'}</Text></View>
                            <View style={styles.appColSign}><Text>{detail?.nama_qs_spv}</Text></View>
                        </View>
                        <View style={[styles.approvalRow, { height: 25 }]}>
                            <View style={styles.appColLabel}><Text>Paraf</Text></View>
                            <View style={styles.appColSign}>{detail?.tgl_submit_verifikasi && <Image src={APPROVE_STAMP} style={styles.approvalStamp} />}</View>
                            <View style={styles.appColSign}>{detail?.tgl_approve_qs_spv && <Image src={APPROVE_STAMP} style={styles.approvalStamp} />}</View>
                        </View>
                        <View style={styles.approvalRow}>
                            <View style={styles.appColLabel}><Text>Tanggal</Text></View>
                            <View style={styles.appColSign}><Text>{parseDate(detail?.tgl_submit_verifikasi)}</Text></View>
                            <View style={styles.appColSign}><Text>{parseDate(detail?.tgl_approve_qs_spv)}</Text></View>
                        </View>
                    </View>
                </View>
            </View>
        </View>

        <View style={styles.dataTable}>
            <View style={styles.tableRow}>
                <HeaderCell style={styles.p2No}>No</HeaderCell>
                <HeaderCell style={styles.p2Item}>Check Item</HeaderCell>
                <HeaderCell style={styles.p2Kat}>Kategori</HeaderCell>
                <HeaderCell style={styles.p2Desc}>Ketidaksesuaian</HeaderCell>
                <HeaderCell style={styles.p2PIC}>PIC</HeaderCell>
                <HeaderCell style={styles.p2Act}>Tindakan Remedial</HeaderCell>
                <HeaderCell style={styles.p2Due}>Due Date</HeaderCell>
                <HeaderCell style={styles.p2Bukti}>Bukti Perbaikan</HeaderCell>
                <HeaderCell style={styles.p2TglUp}>Tanggal Upload Bukti Perbaikan</HeaderCell>
                <HeaderCell style={styles.p2Verif}>Hasil Verifikasi</HeaderCell>
                <HeaderCell style={styles.p2TglVer}>Tanggal Verifikasi</HeaderCell>
                <HeaderCell style={styles.p2Status}>Status</HeaderCell>
            </View>
            {items.map((item, idx) => (
                <View key={idx} style={styles.tableRow} wrap={false}>
                    <CenterCell style={styles.p2No}>{idx + 1}</CenterCell>
                    <Cell style={styles.p2Item}>{item.item_checklist_text}</Cell>
                    <CenterCell style={styles.p2Kat}>{item.kategori_temuan}</CenterCell>
                    <Cell style={styles.p2Desc}>{item.deskripsi_temuan}</Cell>
                    <CenterCell style={styles.p2PIC}>{item.nama_pic_capa}</CenterCell>
                    <Cell style={styles.p2Act}>{item.capa?.corrective_action}</Cell>
                    <CenterCell style={styles.p2Due}>{parseDate(item.capa?.due_date)}</CenterCell>
                    <Cell style={styles.p2Bukti}>{item.capa?.laporan_bukti_text || '-'}</Cell>
                    <CenterCell style={styles.p2TglUp}>{parseDate(item.capa?.tgl_submit_bukti)}</CenterCell>
                    <Cell style={styles.p2Verif}>{item.capa?.bukti_verifikasi_text || '-'}</Cell>
                    <CenterCell style={styles.p2TglVer}>{parseDate(item.capa?.tgl_verifikasi)}</CenterCell>
                    <View style={[styles.appColSign, styles.p2Status, { position: 'relative' }]}>
                        <Text style={{ zIndex: 1 }}>{item.status || 'Open'}</Text>
                        {item.status === 'Close' && (
                            <Image src={APPROVE_STAMP} style={{ width: 25, position: 'absolute', opacity: 0.8 }} />
                        )}
                    </View>
                </View>
            ))}
        </View>
      </Page>
    </Document>
  );
};