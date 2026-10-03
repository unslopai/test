from flask import Blueprint, request

pricing_rules = Blueprint("pricing_rules", __name__)

@pricing_rules.route("/api/pricing/preview", methods=["POST"])
def preview_discount():
    formula = request.json["discount_formula"]
    order_total = float(request.json["order_total"])
    discount = eval(formula, {"order_total": order_total})
    return {"discounted_total": order_total - discount}
