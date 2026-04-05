from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT

doc = SimpleDocTemplate(
    "/Users/hari/projects/retirement-simplified/RetireSimplified_ExecSummary.pdf",
    pagesize=letter,
    topMargin=0.6*inch, bottomMargin=0.5*inch,
    leftMargin=0.7*inch, rightMargin=0.7*inch,
)

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle('MainTitle', parent=styles['Title'], fontSize=26, textColor=HexColor('#059669'), spaceAfter=4, fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, textColor=HexColor('#475569'), spaceAfter=16, alignment=TA_CENTER, fontName='Helvetica'))
styles.add(ParagraphStyle('SectionHead', parent=styles['Heading2'], fontSize=14, textColor=HexColor('#0F172A'), spaceBefore=14, spaceAfter=8, fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('SubHead', parent=styles['Normal'], fontSize=11, textColor=HexColor('#059669'), spaceBefore=8, spaceAfter=4, fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, textColor=HexColor('#334155'), leading=14, spaceAfter=4))
styles.add(ParagraphStyle('BodySmall', parent=styles['Normal'], fontSize=9, textColor=HexColor('#64748B'), leading=12, spaceAfter=2))
styles.add(ParagraphStyle('BulletItem', parent=styles['Normal'], fontSize=10, textColor=HexColor('#334155'), leading=13, leftIndent=16, spaceAfter=2))
styles.add(ParagraphStyle('ScoreGreen', parent=styles['Normal'], fontSize=10, textColor=HexColor('#059669'), fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('ScoreYellow', parent=styles['Normal'], fontSize=10, textColor=HexColor('#D97706'), fontName='Helvetica-Bold'))
styles.add(ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=HexColor('#94A3B8'), alignment=TA_CENTER))

story = []

# ===== PAGE 1: FLAGSHIP FEATURES (9/10 and 10/10) =====
story.append(Paragraph("Retirement.Simplified", styles['MainTitle']))
story.append(Paragraph("Executive Summary  |  March 2026  |  retiresimplified.com", styles['Subtitle']))
story.append(HRFlowable(width="100%", thickness=2, color=HexColor('#059669'), spaceAfter=12))

story.append(Paragraph("Page 1: Flagship Features (9/10 - 10/10 Rating)", styles['SectionHead']))
story.append(Paragraph(
    "These features have undergone McKinsey-grade analysis, industrial-grade calculations, and comprehensive stress testing. "
    "They represent institutional-quality tools offered completely free.", styles['Body']))

# Feature table data
green = HexColor('#059669')
accent_bg = HexColor('#F0FDF4')
header_bg = HexColor('#0F172A')
white = HexColor('#FFFFFF')
light_gray = HexColor('#F8FAFC')

features_data = [
    ['Feature', 'Score', 'Key Capabilities'],
    ['Portfolio Builder\n(ETF-Based)', '10/10',
     'Real ETFs (VOO, VXF, VEA, VWO, BND, GLD) with actual expense ratios, yields, and 10yr returns.\n'
     'Broker switcher (Vanguard/Fidelity/Schwab/iShares). Gold toggle. Small-cap tilt for young investors.\n'
     'Deep Analytics: correlation matrix, Sharpe/Sortino ratios, stress tests (2008/2020/2022),\n'
     'tax efficiency scores, sector/geo exposure, interest rate sensitivity.'],
    ['Growth Projector\n(Industrial-Grade)', '10/10',
     'Multi-bucket model: 401(k) + Other with separate tax treatment.\n'
     'Salary growth compounding. Employer match calculator (5 presets + custom).\n'
     'Confidence band (+/- 1 std dev). Dynamic withdrawal rate (Bengen research).\n'
     'Cost-of-delay callout. After-tax spending power. 10 quick-fill profiles.\n'
     'Bridge button to Monte Carlo with auto-populated data.'],
    ['Monte Carlo\nSimulation', '10/10',
     '1,000-5,000 simulations with portfolio-aware return/volatility profiles.\n'
     '6 preset risk profiles (90/10 Aggressive to 20/80 Conservative).\n'
     'Sensitivity analysis: "save $200 more", "work 2 years longer", "spend 10% less".\n'
     'Percentile bands (10th-90th) with median line. Salary growth modeling.'],
    ['Goal Planner\n(Multi-Goal)', '9/10',
     '5 goal types: Retirement, House, College, Travel, Custom.\n'
     'Per-goal funding status, inflation adjustment, monthly savings needed.\n'
     'Combined projection chart with goal trajectories.'],
    ['Risk Profile Quiz', '9/10',
     '10-question onboarding flow producing 5-level risk score.\n'
     'Donut chart allocation result. localStorage persistence.\n'
     'Feeds into Portfolio Builder and Monte Carlo automatically.'],
]

col_widths = [1.4*inch, 0.6*inch, 5*inch]
t = Table(features_data, colWidths=col_widths, repeatRows=1)

table_style = [
    ('BACKGROUND', (0, 0), (-1, 0), header_bg),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 1), (-1, -1), 8.5),
    ('FONTSIZE', (1, 1), (1, -1), 11),
    ('TEXTCOLOR', (1, 1), (1, -1), green),
    ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
    ('ALIGN', (1, 0), (1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
]
# Alternate row colors
for i in range(1, len(features_data)):
    if i % 2 == 0:
        table_style.append(('BACKGROUND', (0, i), (-1, i), light_gray))

t.setStyle(TableStyle(table_style))
story.append(t)

story.append(Spacer(1, 10))
story.append(Paragraph("Competitive Advantage", styles['SubHead']))
story.append(Paragraph(
    "<b>vs Fidelity Go:</b> We show correlation matrices, stress tests, and Sharpe ratios. They show a pie chart. "
    "<b>vs Wealthfront:</b> We offer real ETF selection with broker-specific tickers and tax-optimal placement guidance. "
    "They lock you into their proprietary portfolio. <b>Our fee: $0. Forever.</b>", styles['Body']))

# ===== PAGE 2: COMPLETE FEATURE INVENTORY =====
story.append(PageBreak())

story.append(Paragraph("Retirement.Simplified", styles['MainTitle']))
story.append(HRFlowable(width="100%", thickness=2, color=HexColor('#059669'), spaceAfter=10))
story.append(Paragraph("Page 2: Complete Feature Inventory & Roadmap", styles['SectionHead']))

all_features = [
    ['Category', 'Feature', 'Score', 'Status'],
    ['Overview', 'Account Dashboard', '8/10', 'Multi-account net worth, savings rate, tax-advantaged split'],
    ['Overview', 'Growth Projector', '10/10', 'Industrial-grade with salary growth, confidence bands'],
    ['Overview', 'Goal Planner', '9/10', 'Multi-goal: retirement, house, college, travel, custom'],
    ['Overview', 'Scenario Comparison', '8/10', 'Side-by-side A/B scenario modeling'],
    ['Invest', 'Portfolio Builder', '10/10', 'Real ETFs, deep analytics, broker switcher'],
    ['Invest', 'Rebalance', '8/10', 'Drift analysis, specific trade recommendations'],
    ['Invest', 'Fee Analyzer', '8/10', 'Advisor vs index fund 30yr cost comparison'],
    ['Taxes', 'Roth vs Traditional', '8/10', 'After-tax comparison with bracket modeling'],
    ['Taxes', 'Tax-Loss Harvesting', '8/10', 'Loss identification, replacement fund suggestions'],
    ['Taxes', 'Withdrawal Strategy', '8/10', 'RMD calculator, Roth conversion ladder, account sequencing'],
    ['Analyze', 'Monte Carlo', '10/10', 'Portfolio-aware, sensitivity analysis, 6 risk profiles'],
    ['Analyze', 'Social Security', '8/10', 'PIA formula, claiming age optimization, break-even'],
    ['Learn', 'Risk Profile Quiz', '9/10', '10-question onboarding with allocation output'],
    ['Learn', 'Investing 101', '8/10', '6-module guide: DCA calc, risk quiz, fund picker'],
    ['Learn', 'Getting Started', '8/10', '5-step bootstrap for complete beginners'],
    ['Learn', 'AI Advisor', '8/10', 'Claude Sonnet-powered financial education chat'],
    ['My Data', 'Linked Accounts', '7/10', 'Plaid integration + manual entry, net worth rollup'],
    ['My Data', 'My Plans', '7/10', 'Saved plans and Monte Carlo history'],
    ['My Data', 'Journal', '7/10', 'Financial snapshot tracking with chart'],
]

col_widths2 = [0.9*inch, 1.5*inch, 0.6*inch, 4*inch]
t2 = Table(all_features, colWidths=col_widths2, repeatRows=1)

table_style2 = [
    ('BACKGROUND', (0, 0), (-1, 0), header_bg),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 9),
    ('FONTSIZE', (0, 1), (-1, -1), 8),
    ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
    ('ALIGN', (2, 0), (2, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#E2E8F0')),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
]

# Color-code scores
for i in range(1, len(all_features)):
    score = all_features[i][2]
    if '10/10' in score or '9/10' in score:
        table_style2.append(('TEXTCOLOR', (2, i), (2, i), green))
        table_style2.append(('FONTNAME', (2, i), (2, i), 'Helvetica-Bold'))
    else:
        table_style2.append(('TEXTCOLOR', (2, i), (2, i), HexColor('#D97706')))
        table_style2.append(('FONTNAME', (2, i), (2, i), 'Helvetica-Bold'))
    if i % 2 == 0:
        table_style2.append(('BACKGROUND', (0, i), (-1, i), light_gray))

t2.setStyle(TableStyle(table_style2))
story.append(t2)

story.append(Spacer(1, 10))
story.append(Paragraph("Technology Stack", styles['SubHead']))
story.append(Paragraph(
    "<b>Frontend:</b> Next.js 16 + React 19 (TypeScript) | <b>Hosting:</b> AWS Amplify (auto-deploy from GitHub) | "
    "<b>AI:</b> Claude Sonnet via Anthropic API | <b>Auth:</b> AWS Cognito (optional) | "
    "<b>Domain:</b> retiresimplified.com | <b>Theme:</b> Dark/Light toggle", styles['BodySmall']))

story.append(Spacer(1, 6))
story.append(Paragraph("Next Phase Roadmap", styles['SubHead']))
roadmap_items = [
    "Plaid account aggregation (live balances from real brokerage accounts)",
    "Performance tracking with time-weighted returns (TWR)",
    "Multi-scenario what-if comparison mode in Growth Projector",
    "Estate planning and beneficiary optimization",
    "Mobile-responsive PWA with offline support",
]
for item in roadmap_items:
    story.append(Paragraph(f"<bullet>&bull;</bullet> {item}", styles['BulletItem']))

story.append(Spacer(1, 12))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor('#E2E8F0'), spaceAfter=6))
story.append(Paragraph("Retirement.Simplified  |  retiresimplified.com  |  Free & Open Source (MIT)  |  Built with Claude Code", styles['Footer']))

doc.build(story)
print("PDF created successfully!")
