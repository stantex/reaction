import SimpleSchema from "simpl-schema";
import ReactionError from "@reactioncommerce/reaction-error";

const bulkDiscountCalcInput = new SimpleSchema({
  fixed: {
    type: Number,
    optional: true
  },
  variable_each: {
    type: Number,
    optional: true
  },
  variable_72: {
    type: Number,
    optional: true
  }
})

const pricesInput = new SimpleSchema({
  compareAtPrice: {
    type: Number,
    optional: true
  },
  price: {
    type: Number,
    optional: true
  },
  bulkDiscountCalc: {
    type: bulkDiscountCalcInput,
    optional: true
  }
});

const inputSchema = new SimpleSchema({
  prices: {
    type: pricesInput
  },
  shopId: String,
  variantId: String
});

/**
 * @method updateProductVariantPrices
 * @summary Updates the price fields on a product variant
 * @param {Object} context -  an object containing the per-request state
 * @param {Object} input - Input arguments for the bulk operation
 * @param {Object} input.prices - prices to update
 * @param {Object} [input.prices.compareAtPrice] - variant compareAtPrice
 * @param {Object} [input.prices.price] - variant price
 * @param {Object} input.prices.bulkDiscountCalc - bulkDiscountCalc to update
 * @param {Object} [input.prices.bulkDiscountCalc.fixed] - fixed cost calculation
 * @param {Object} [input.prices.bulkDiscountCalc.variable_each] - variable_each cost calculation
 * @param {Object} [input.prices.bulkDiscountCalc.variable_72] - variable_72 cost calculation
 * @param {String} input.variantId - variantId of product to update
 * @param {String} input.shopId - shopId of shop product belongs to
 * @return {Promise<Object>} updateProductVariant payload
 */
export default async function updateProductVariantPrices(context, input) {
  inputSchema.validate(input);
  const { appEvents, collections } = context;
  const { Products } = collections;
  const { prices, variantId, shopId } = input;

  console.log("PRICES:", prices)

  // Check that user has permission to create product
  await context.validatePermissions(`reaction:legacy:products:${variantId}`, "update:prices", {
    shopId
  });

  const fields = Object.keys(prices);
  if (fields.length === 0) throw new ReactionError("invalid-param", "At least one field to update must be provided");

  let update = { $set: { ...prices } }
  console.log("UPDATE:", update)

  const { value: updatedProductVariant } = await Products.findOneAndUpdate(
    { _id: variantId, shopId, type: "variant" },
    update,
    { returnOriginal: false }
  );

  if (!updatedProductVariant) throw new ReactionError("error-occurred", "Unable to update variant prices");

  console.log("UPDATE MUTATION 1")

  await appEvents.emit("afterVariantUpdate", {
    fields,
    productId: updatedProductVariant.ancestors[0],
    productVariant: updatedProductVariant,
    productVariantId: variantId
  });

  return updatedProductVariant;
}
