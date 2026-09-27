import base64
import html
import io
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT = Path(__file__).resolve().parent.parent / "public" / "samples"
PREPARED = "September 27, 2026"
PERIOD = "Aug 15 2026 to Feb 15 2027"
AGENT = ["Riley Morgan, Agent", "Sunrise Coast Agency (sample)", "400 Example Blvd, Tampa, FL 33602", "(813) 555-0142", "agent@example.com"]
NO_BI = (
    "THIS POLICY DOES NOT PROVIDE BODILY INJURY LIABILITY INSURANCE OR ANY OTHER COVERAGE FOR WHICH A SPECIFIC PREMIUM "
    "CHARGE IS NOT MADE AND DOES NOT COMPLY WITH THE BODILY INJURY LIABILITY REQUIREMENTS OF ANY FINANCIAL RESPONSIBILITY LAW."
)
COVERAGE = {
    "A": "Liability Coverage (Bodily Injury and Property Damage)",
    "B": "Property Damage Liability Coverage",
    "P10": "No-Fault Coverage (Personal Injury Protection)",
    "C": "Medical Payments Coverage",
    "U": "Uninsured Motor Vehicle Coverage - Stacking",
    "U3": "Uninsured Motor Vehicle Coverage - Non-Stacking",
    "D": "Comprehensive Coverage",
    "G": "Collision Coverage",
    "H": "Emergency Road Service Coverage",
    "R1": "Car Rental and Travel Expenses Coverage",
}
PIP_TERMS = [
    "No-Fault pays 80% of properly billed medical expenses, but only if initial services and care are received within 14 days after the accident.",
    "No-Fault Medical Expenses limit: $10,000 if an emergency medical condition is determined, $2,500 if it is not. Death Benefit: $5,000 per deceased insured.",
    "Florida No-Fault pays 60% of lost income, within the same $10,000 per person limit.",
]
PHYSICAL_TERMS = [
    "Comprehensive and Collision pay up to $1,000 per cat or dog injured in a covered loss, $2,000 per loss.",
    "There is no coverage for wear and tear, freezing, or mechanical or electrical breakdown.",
    "Physical damage coverages do not apply while the driver is logged on to a transportation network (rideshare) platform.",
]

PLANS = [
    {
        "file": "state-farm-florida-minimum",
        "plan": "Florida minimum",
        "policy": "9990001-B27-59",
        "insured": "Jamie Carter",
        "address": ["1200 Sample St Apt 4", "Orlando, FL 32801"],
        "use": "Pleasure",
        "vehicle": ("2021", "Honda", "Civic", "2HGFE2F5SAMPLE001"),
        "creditor": "None",
        "message": NO_BI,
        "coverages": [
            ("B", 212.40, None, "Property Damage: $10,000 each accident"),
            ("P10", 286.10, "$1,000 N", "$10,000 each person for Medical Expenses, Income Loss and Replacement Services Loss; Death Benefit $5,000"),
        ],
        "notes": [
            "Uninsured Motor Vehicle Coverage was rejected in writing (Form 1012826 on file).",
            "No Bodily Injury Liability Coverage: injuries you cause to other people are not covered.",
            "No Comprehensive or Collision Coverage: damage to your own car is not covered.",
            *PIP_TERMS,
        ],
    },
    {
        "file": "state-farm-florida-liability",
        "plan": "Liability + PIP",
        "policy": "9990002-C27-59",
        "insured": "Sam Nguyen",
        "address": ["88 Example Ave", "Tampa, FL 33602"],
        "use": "Commute",
        "vehicle": ("2022", "Toyota", "Corolla", "5YFB4MDESAMPLE002"),
        "creditor": "None",
        "message": None,
        "coverages": [
            ("A", 389.20, None, "Bodily Injury: $25,000 each person, $50,000 each accident; Property Damage: $25,000 each accident"),
            ("P10", 241.80, "$500 N", "$10,000 each person for Medical Expenses, Income Loss and Replacement Services Loss; Death Benefit $5,000"),
            ("U3", 148.60, None, "Bodily Injury: $25,000 each person, $50,000 each accident"),
        ],
        "notes": [
            "No Comprehensive or Collision Coverage: damage to your own car is not covered.",
            *PIP_TERMS,
        ],
    },
    {
        "file": "state-farm-florida-full",
        "plan": "Full coverage",
        "policy": "9990003-D27-59",
        "insured": "Taylor Brooks",
        "address": ["350 Demo Way", "Miami, FL 33130"],
        "use": "Commute",
        "vehicle": ("2021", "Peugeot", "308", "VF3LBYHZSAMPLE003"),
        "creditor": "Coastal Sample Credit Union",
        "message": None,
        "coverages": [
            ("A", 512.30, None, "Bodily Injury: $100,000 each person, $300,000 each accident; Property Damage: $100,000 each accident"),
            ("P10", 198.40, "$250 N", "$10,000 each person for Medical Expenses, Income Loss and Replacement Services Loss; Death Benefit $5,000"),
            ("C", 38.10, None, "$5,000 each insured"),
            ("U3", 221.70, None, "Bodily Injury: $100,000 each person, $300,000 each accident"),
            ("D", 164.90, "$500", "Actual cash value, less deductible. No deductible for windshield damage."),
            ("G", 402.60, "$500", "Actual cash value, less deductible. Deductible does not apply to windshield glass repair."),
        ],
        "notes": [
            "If your car is stolen, Comprehensive pays transportation expenses of $25 per day, up to $750 per loss.",
            "No Emergency Road Service or Car Rental and Travel Expenses Coverage on this policy.",
            *PIP_TERMS,
            *PHYSICAL_TERMS,
        ],
    },
    {
        "file": "state-farm-florida-full-extras",
        "plan": "Full coverage + extras",
        "policy": "9990004-E27-59",
        "insured": "Morgan Diaz",
        "address": ["71 Placeholder Ct", "Jacksonville, FL 32202"],
        "use": "Commute",
        "vehicle": ("2023", "Tesla", "Model 3", "5YJ3E1EASAMPLE004"),
        "creditor": "Sample Auto Finance LLC",
        "message": None,
        "coverages": [
            ("A", 598.40, None, "Bodily Injury: $250,000 each person, $500,000 each accident; Property Damage: $100,000 each accident"),
            ("P10", 231.20, "$0", "$10,000 each person for Medical Expenses, Income Loss and Replacement Services Loss; Death Benefit $5,000"),
            ("C", 52.60, None, "$10,000 each insured"),
            ("U", 268.90, None, "Bodily Injury: $250,000 each person, $500,000 each accident"),
            ("D", 214.30, "$250", "Actual cash value, less deductible. No deductible for windshield damage."),
            ("G", 506.80, "$500", "Actual cash value, less deductible. Deductible does not apply to windshield glass repair."),
            ("H", 14.20, None, "Up to 1 hour of labor at the breakdown, towing to the nearest repair facility, gas/oil/battery/tire delivery (not the item itself), up to 1 hour of locksmith labor"),
            ("R1", 36.50, None, "Car Rental and Transportation: $50 each day, $1,500 each loss; Travel Expenses $500 each loss; Rental Car Repayment of Deductible $500 each loss"),
        ],
        "notes": [
            "If your car is stolen, Comprehensive pays transportation expenses of $25 per day, up to $750 per loss.",
            *PIP_TERMS,
            *PHYSICAL_TERMS,
        ],
    },
]

CSS = """
@page { size: letter; margin: 0.55in 0.6in 0.7in; }
* { box-sizing: border-box; }
body { font: 9.5pt/1.4 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
.wm { position: fixed; top: 22%; left: 8%; width: 84%; z-index: -1; }
.banner { border: 1.5px solid #c8102e; color: #8a0b1f; background: #fff4f5; padding: 6px 9px; font-size: 8.5pt; margin-bottom: 12px; }
header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c8102e; padding-bottom: 8px; margin-bottom: 10px; }
h1 { font-size: 15pt; margin: 0; }
h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: .04em; margin: 14px 0 5px; border-bottom: 1px solid #999; padding-bottom: 2px; }
.co { text-align: right; font-weight: bold; color: #c8102e; font-size: 10.5pt; }
table { width: 100%; border-collapse: collapse; }
td, th { text-align: left; vertical-align: top; padding: 3px 6px; border: 1px solid #ccc; }
th { background: #f1f1f1; font-size: 8.5pt; }
.kv td { border: none; padding: 1px 6px 1px 0; }
.kv td:first-child { width: 1.4in; font-weight: bold; }
.num { text-align: right; white-space: nowrap; }
.msg { font-weight: bold; font-size: 8.5pt; margin: 8px 0; }
.cols { display: flex; gap: 18px; }
.cols > div { flex: 1; }
p { margin: 5px 0; }
ul { margin: 4px 0; padding-left: 16px; }
.small { font-size: 8pt; color: #333; }
.keep { break-inside: avoid; }
"""


def watermark() -> str:
    img = Image.new("RGBA", (1400, 320), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((700, 160), "SAMPLE", font=ImageFont.load_default(size=260), fill=(200, 16, 46, 26), anchor="mm")
    buf = io.BytesIO()
    img.rotate(30, expand=True).save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


WATERMARK = watermark()


def money(n: float) -> str:
    return f"${n:,.2f}"


def render(p: dict) -> str:
    e = html.escape
    year, make, model, vin = p["vehicle"]
    total = sum(c[1] for c in p["coverages"])
    symbols = [c[0] for c in p["coverages"]]
    endorsements = [("2281A", "Florida Non-Cancellable Policy", "001")]
    rows_premium = "".join(f'<td class="num">{money(c[1])}</td>' for c in p["coverages"])
    rows_deductible = "".join(f'<td class="num">{e(c[2] or "")}</td>' for c in p["coverages"])
    coverage_rows = "".join(f"<tr><td>{e(c[0])}</td><td>{e(COVERAGE[c[0]])}</td><td>{e(c[3])}</td></tr>" for c in p["coverages"])
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>{e(p['plan'])} sample declarations</title><style>{CSS}
@page {{ @bottom-left {{ content: "Policy Number: {p['policy']} · Prepared {PREPARED} · Demo sample modeled on P1010023 FL, not issued by State Farm"; font: 7.5pt Arial; color: #555; }} @bottom-right {{ content: "Page " counter(page) " of " counter(pages); font: 7.5pt Arial; color: #555; }} }}</style></head><body>
<img class="wm" src="{WATERMARK}" alt="">
<div class="banner"><b>DEMO SAMPLE.</b> Made by BeCarful from State Farm's Florida declarations template (P1010023 FL, OIR filing 24-098215) and car policy booklet (Form 9810C) for a demo. Not issued by State Farm. The insured, vehicle, policy number and premiums are fictional. Plan: {e(p['plan'])}.</div>
<header><div><h1>Declarations Page</h1><div>Florida Car Policy</div></div><div class="co">State Farm Mutual Automobile<br>Insurance Company</div></header>
<table class="kv">
<tr><td>Policy number:</td><td>{e(p['policy'])}</td></tr>
<tr><td>Named insured(s):</td><td>{e(p['insured'])}</td></tr>
<tr><td>Policy period:</td><td>{PERIOD}<br><span class="small">The policy period begins and ends at 12:01 am standard time.</span></td></tr>
</table>
{f'<p class="msg">State Specific Messages: {e(p["message"])}</p>' if p['message'] else ''}
<div class="cols" style="margin-top:8px">
<div><b>Policy address:</b><br>{e(p['insured'])}<br>{'<br>'.join(e(a) for a in p['address'])}</div>
<div><b>Use of the vehicle(s):</b> {e(p['use'])}<br><b>Paperless Notices to:</b> {e(p['insured'].split()[0].lower())}@example.com</div>
<div><b>Agent:</b><br>{'<br>'.join(e(a) for a in AGENT)}</div>
</div>
<p class="small">This policy will be renewed automatically subject to the rates in effect, the coverages carried, the applicable limits, deductibles, and other elements that affect the premium that apply at the time of renewal.</p>
<p class="small">This is not a bill. The policy premium is being applied to your billing account. The premium(s) shown in the table(s) below are for the policy period and policy characteristics described in this Declarations.</p>

<h2>Vehicle(s) covered</h2>
<table><tr><th>Vehicle</th><th>Vehicle Identification Number (VIN)</th><th class="num">Premium</th></tr>
<tr><td>Vehicle 001 – {e(year)} {e(make)} {e(model)}</td><td>{e(vin)}</td><td class="num">{money(total)}</td></tr>
<tr><td colspan="2" class="num"><b>Total premium:</b></td><td class="num"><b>{money(total)}</b></td></tr></table>

<h2>Policy premium</h2>
<table><tr><th>Vehicle</th><th></th>{''.join(f'<th class="num">{e(s)}</th>' for s in symbols)}</tr>
<tr><td rowspan="2">001</td><td>Premium</td>{rows_premium}</tr>
<tr><td>Deductible</td>{rows_deductible}</tr></table>

<div class="keep"><h2>Coverages and limits</h2>
<p class="small">This policy provides the following Coverages to the vehicles for which the appropriate “Coverage Symbol” and a corresponding premium are shown in the “POLICY PREMIUM” schedules above.</p>
<table><tr><th>Coverage Symbol</th><th>Coverage</th><th>Limit</th></tr>{coverage_rows}</table></div>

<div class="keep"><h2>Vehicle schedule</h2>
<table><tr><th>Vehicle year / Make / Model</th><th>VIN</th><th>Garaged address</th><th>Creditors</th></tr>
<tr><td>{e(year)} {e(make)} {e(model)}</td><td>{e(vin)}</td><td>{'<br>'.join(e(a) for a in p['address'])}</td><td>{e(p['creditor'])}</td></tr></table></div>

<div class="keep"><h2>Policy forms and endorsements</h2>
<p class="small">This policy consists of this Declarations, the policy booklet - Form 9810C, and any endorsements that apply, including those listed below as well as those issued subsequent to the issuance of this policy.</p>
<table><tr><th>Endorsement number</th><th>Endorsement description</th><th>Vehicle number</th></tr>
{''.join(f'<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>' for a, b, c in endorsements)}</table></div>

<div class="keep"><h2>Key terms (summary of Form 9810C)</h2><ul>{''.join(f'<li>{e(n)}</li>' for n in p['notes'])}</ul></div>

<div class="keep"><h2>Important notice</h2>
<p class="small">Under No-Fault Coverage, the only medical expenses we will pay are reasonable medical expenses that are payable under the Florida Motor Vehicle No-Fault Law. The most we will pay for such reasonable medical expenses is 80% of the “schedule of maximum charges” found in the Florida Motor Vehicle No-Fault Law and in the Limits section of the Florida Personal Car Policy’s No-Fault Coverage.</p>
<p class="small">Membership. While this policy is in force, the first named insured shown on the Declarations is entitled to vote at all meetings of members and to receive dividends the Board of Directors in its sole discretion may declare. No contingent liability. This policy is non-assessable.</p></div>
</body></html>"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for p in PLANS:
            src = Path(tmp) / f"{p['file']}.html"
            src.write_text(render(p), encoding="utf-8")
            pdf = OUT / f"{p['file']}.pdf"
            subprocess.run(
                [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={pdf}", src.as_uri()],
                check=True,
                capture_output=True,
            )
            print(pdf.relative_to(OUT.parent.parent))


if __name__ == "__main__":
    main()
