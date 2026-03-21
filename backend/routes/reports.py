from flask import Blueprint, jsonify, send_file, g
from auth_utils import require_auth
from services.plan_limits import check_feature
import io
from datetime import datetime

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/monthly', methods=['GET'])
@require_auth
def monthly_report():
    # Plan check
    allowed, msg = check_feature(g.tenant, 'pdf_reports')
    if not allowed:
        return jsonify({'error': msg, 'upgrade_required': True, 'current_plan': g.tenant.plan}), 403

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=letter,
                                topMargin=0.5*inch, bottomMargin=0.5*inch,
                                leftMargin=0.75*inch, rightMargin=0.75*inch)
        styles  = getSampleStyleSheet()
        story   = []
        BG      = colors.HexColor('#0a0e1a')
        CYAN    = colors.HexColor('#00d4ff')
        GREEN   = colors.HexColor('#10b981')
        ORANGE  = colors.HexColor('#f59e0b')
        LIGHT   = colors.HexColor('#f1f5f9')
        MUTED   = colors.HexColor('#94a3b8')

        title_style = ParagraphStyle('title', parent=styles['Title'],
                                     textColor=LIGHT, fontSize=22, spaceAfter=4)
        sub_style   = ParagraphStyle('sub', parent=styles['Normal'],
                                     textColor=MUTED, fontSize=11, spaceAfter=16)
        h2_style    = ParagraphStyle('h2', parent=styles['Heading2'],
                                     textColor=CYAN, fontSize=13, spaceBefore=16, spaceAfter=8)

        # Header
        story.append(Paragraph(f"Cloud Cost Report — {g.tenant.name}", title_style))
        story.append(Paragraph(f"Generated: {datetime.today().strftime('%B %d, %Y')} · Cloudonomix", sub_style))
        story.append(HRFlowable(width='100%', thickness=1, color=CYAN))
        story.append(Spacer(1, 0.2*inch))

        # Collect cost data from all connected clouds
        all_services = []
        total_spend  = 0

        if g.tenant.aws_ok:
            try:
                from services.aws_service import get_cost_summary_cached
                data = get_cost_summary_cached(g.tenant)
                if data:
                    curr = data[-1]
                    total_spend += curr['total']
                    for s in curr['services'][:8]:
                        all_services.append(['☁️ AWS', s['service'], f"${s['cost']:,.2f}"])
                    story.append(Paragraph("Amazon Web Services", h2_style))
                    _add_monthly_table(story, data, styles, CYAN, LIGHT, MUTED)
            except Exception as e:
                story.append(Paragraph(f"AWS data unavailable: {str(e)}", sub_style))

        if g.tenant.azure_ok:
            try:
                from services.azure_service import get_cost_summary
                data = get_cost_summary(g.tenant)
                if data:
                    curr     = data[-1]
                    currency = curr.get('currency', 'USD')
                    sym      = '₹' if currency == 'INR' else '$'
                    total_spend += curr['total']
                    for s in curr['services'][:8]:
                        all_services.append(['🔷 Azure', s['service'], f"{sym}{s['cost']:,.2f}"])
                    story.append(Paragraph("Microsoft Azure", h2_style))
                    _add_monthly_table(story, data, styles, colors.HexColor('#0078D4'), LIGHT, MUTED, sym)
            except Exception as e:
                story.append(Paragraph(f"Azure data unavailable: {str(e)}", sub_style))

        if g.tenant.gcp_ok:
            try:
                from services.gcp_service import get_cost_summary
                data = get_cost_summary(g.tenant)
                if data:
                    curr = data[-1]
                    total_spend += curr['total']
                    for s in curr['services'][:8]:
                        all_services.append(['🔵 GCP', s['service'], f"${s['cost']:,.2f}"])
                    story.append(Paragraph("Google Cloud Platform", h2_style))
                    _add_monthly_table(story, data, styles, colors.HexColor('#4285F4'), LIGHT, MUTED)
            except Exception as e:
                story.append(Paragraph(f"GCP data unavailable: {str(e)}", sub_style))

        # Top recommendations
        story.append(Paragraph("Top Savings Recommendations", h2_style))
        try:
            from services.recommendations_engine import generate_azure_recommendations
            from services.azure_service import get_cost_summary
            if g.tenant.azure_ok:
                result = generate_azure_recommendations({'monthly': get_cost_summary(g.tenant)})
                recs   = result.get('recommendations', [])[:6]
                if recs:
                    rec_data = [['Service', 'Priority', 'Action', 'Est. Savings']]
                    for r in recs:
                        rec_data.append([
                            r['service'][:25],
                            r['priority'],
                            r['actions'][0][:50] + '...' if r['actions'] else '',
                            f"${r['estimated_savings']:.0f}/mo"
                        ])
                    rt = Table(rec_data, colWidths=[1.5*inch, 0.8*inch, 3.5*inch, 1.0*inch])
                    rt.setStyle(TableStyle([
                        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#10b981')),
                        ('TEXTCOLOR',  (0,0), (-1,0), colors.HexColor('#080c14')),
                        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
                        ('FONTSIZE',   (0,0), (-1,-1), 9),
                        ('ALIGN',      (0,0), (-1,-1), 'LEFT'),
                        ('GRID',       (0,0), (-1,-1), 0.5, colors.HexColor('#1e2d45')),
                        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#111827'), colors.HexColor('#161f30')]),
                        ('TEXTCOLOR',  (0,1), (-1,-1), LIGHT),
                        ('PADDING',    (0,0), (-1,-1), 6),
                    ]))
                    story.append(rt)
        except: pass

        # Footer
        story.append(Spacer(1, 0.3*inch))
        story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#1e2d45')))
        story.append(Paragraph(
            f"Cloudonomix Cloud Cost Report · {g.tenant.name} · Manjunath Project and Softwares · Confidential",
            ParagraphStyle('footer', parent=styles['Normal'], textColor=MUTED, fontSize=8, spaceAfter=0)
        ))

        doc.build(story)
        buf.seek(0)
        fname = f"cloudonomix-report-{g.tenant.slug}-{datetime.today().strftime('%Y-%m')}.pdf"
        return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name=fname)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _add_monthly_table(story, data, styles, color, light, muted, sym='$'):
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib import colors
    rows = [['Month', 'Total Spend']]
    for p in data[-6:]:
        rows.append([p['month'], f"{sym}{p['total']:,.2f}"])
    t = Table(rows, colWidths=[2.5*inch, 2.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), color),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.HexColor('#080c14')),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,-1), 10),
        ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
        ('GRID',       (0,0), (-1,-1), 0.5, colors.HexColor('#1e2d45')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#111827'), colors.HexColor('#161f30')]),
        ('TEXTCOLOR',  (0,1), (-1,-1), light),
        ('PADDING',    (0,0), (-1,-1), 8),
    ]))
    story.append(t)
    from reportlab.platypus import Spacer
    story.append(Spacer(1, 0.15*inch))

@reports_bp.route('/summary', methods=['GET'])
@require_auth
def summary():
    allowed, msg = check_feature(g.tenant, 'pdf_reports')
    return jsonify({
        'available':      allowed,
        'upgrade_message': msg if not allowed else None,
        'current_plan':   g.tenant.plan,
        'last_generated': datetime.today().strftime('%Y-%m-%d'),
    })
