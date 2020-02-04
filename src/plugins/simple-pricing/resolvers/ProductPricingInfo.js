import getCurrencyDefinitionByCode from "@reactioncommerce/api-utils/getCurrencyDefinitionByCode.js";
import getDisplayPrice from "../util/getDisplayPrice.js";

export default {
  currency: (node) => getCurrencyDefinitionByCode(node.currencyCode),
  compareAtPrice: ({ compareAtPrice: amount, currencyCode }) => {
    if (typeof amount === "number" && amount > 0) {
      return { amount, currencyCode };
    }
    return null;
  },
  bulkDiscountCalc: () => {
    return {
      "fixed:": 12.43,
      "variable_each": 1.32,
      "variable_72": 2.34
    }
  },
  displayPrice: (node) => {
    // if (node.displayPrice) {
    //   // Operating in core catalog plugin mode.
    //   // Use displayPrice directly from mongo.
    //   // It was computed at publish time.
    //   return node.displayPrice;
    // }
    // Operating in catalog publisher mode.
    // displayPrice was not computed ahead of time.
    // Compute it on the fly now.
    return getDisplayPrice(node.minPrice, node.maxPrice, getCurrencyDefinitionByCode(node.currencyCode));
  }
};
