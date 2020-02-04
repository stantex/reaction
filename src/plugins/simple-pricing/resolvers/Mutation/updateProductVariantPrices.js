import { decodeProductOpaqueId, decodeShopOpaqueId } from "../../xforms/id.js";

/**
 *
 * @method updateProductVariantPrices
 * @summary Updates the price fields on a product variant
 * @param {Object} _ - unused
 * @param {Object} args - The input arguments
 * @param {Object} args.input - mutation input object
 * @param {String} args.input.clientMutationId - The mutation id
 * @param {Object} args.input.prices - prices to update
 * @param {Object} [args.input.prices.compareAtPrice] - variant compareAtPrice
 * @param {Object} [args.input.prices.price] - variant price
 * @param {Object} args.input.prices.bulkDiscountCalc - bulkDiscountCalc to update
 * @param {Object} [args.input.prices.bulkDiscountCalc.fixed] - fixed cost calculation
 * @param {Object} [args.input.prices.bulkDiscountCalc.variable_each] - variable_each cost calculation
 * @param {Object} [args.input.prices.bulkDiscountCalc.variable_72] - variable_72 cost calculation
 * @param {String} args.input.shopId - shopId of shop product belongs to
 * @param {String} args.input.variantId - Id of variant to update
 * @param {Object} context - an object containing the per-request state
 * @return {Promise<Object>} updateProductVariantPrices payload
 */
export default async function updateProductVariantPrices(_, { input }, context) {
  const {
    clientMutationId = null,
    prices,
    shopId,
    variantId
  } = input;

  console.log("PRICES 2:", prices)

  const updatedVariant = await context.mutations.updateProductVariantPrices(context, {
    variantId: decodeProductOpaqueId(variantId),
    shopId: decodeShopOpaqueId(shopId),
    prices
  });

  console.log("UPDATE MUTATION 2")

  return {
    clientMutationId,
    variant: updatedVariant
  };
}
