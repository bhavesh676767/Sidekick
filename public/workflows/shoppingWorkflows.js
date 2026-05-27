(function () {
  self.SidekickWorkflowPacks = self.SidekickWorkflowPacks || [];
  self.SidekickWorkflowPacks.push({
    category: "shopping",
    workflows: [
      {
        id: "find_best_product",
        name: "Find Best Product",
        triggers: ["find best", "best", "recommend", "value for money"],
        requiredSlots: ["query"],
        optionalSlots: ["budget", "marketplace"],
        steps: ["choose_marketplace", "search_marketplaces", "extract_products", "rank_products", "show_summary"],
        followups: [{ key: "preferredMarketplace", question: "Prefer Amazon or Flipkart?", buttons: ["Amazon", "Flipkart", "Compare both", "Remember this"] }],
        safetyRules: ["Never purchase automatically", "Never enter payment details"]
      },
      {
        id: "cheapest_product",
        name: "Cheapest Product",
        triggers: ["cheapest", "lowest price", "cheap"],
        requiredSlots: ["query"],
        optionalSlots: ["budget", "marketplace"],
        steps: ["search_marketplaces", "extract_prices", "sort_lowest_price", "show_best_5"],
        followups: [],
        safetyRules: ["Never purchase automatically"]
      },
      {
        id: "clothing_search",
        name: "Clothing Search",
        triggers: ["hoodie", "shirt", "jeans", "jacket", "sneakers", "dress"],
        requiredSlots: ["query"],
        optionalSlots: ["color", "size", "marketplace"],
        steps: ["open_myntra_or_ajio", "search", "extract_products", "compare"],
        followups: [],
        safetyRules: ["Never purchase automatically"]
      },
      {
        id: "compare_products",
        name: "Compare Products",
        triggers: ["compare these", "compare products", "compare laptops", "compare phones"],
        requiredSlots: [],
        optionalSlots: ["criteria"],
        steps: ["extract_visible_products", "compare_price_specs_rating", "show_table"],
        followups: [],
        safetyRules: ["Use visible data only"]
      },
      {
        id: "coupon_deal_check",
        name: "Coupon / Deal Check",
        triggers: ["find discount", "coupon", "deal check", "promo code"],
        requiredSlots: [],
        optionalSlots: ["query"],
        steps: ["inspect_page", "extract_coupon_text", "show_visible_deals"],
        followups: [],
        safetyRules: ["Do not bypass checkout or payment"]
      }
    ]
  });
})();
