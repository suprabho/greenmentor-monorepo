/**
 * The goals step frames success over three months, and three is about what
 * anyone actually moves in a quarter — more than that is a wishlist, not a
 * plan, and it flattens the signal we hand the AI Hub.
 *
 * Enforced in three places: the picker disables the remaining chips, the store
 * refuses the add, and the API schema rejects the payload.
 *
 * Deliberately its own module rather than living next to the goal list in
 * lib/onboarding-data.ts — that file imports Phosphor icons for the audience
 * cards and type-imports the store, neither of which belongs in a Node runtime
 * route handler.
 */
export const MAX_GOALS = 3;
