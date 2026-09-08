export type BusinessAnalyticsMetrics = {
  published: boolean;
  publishedUrl: string | null;
  visitors: null;
  visitorsStatus: "not_measured";
  enquiries: number;
  orders: number;
  paidOrders: number;
  fulfilledOrders: number;
  paidRevenuePaise: number;
  currency: "INR";
  enquiryToPaidOrderRate: number | null;
};

export function aggregateBusinessAnalytics(input: {
  enquiries: readonly unknown[];
  orders: readonly { status: string; paymentStatus: string; totalPaise: number }[];
  published: boolean;
  publishedUrl: string | null;
}): BusinessAnalyticsMetrics {
  const paidOrders = input.orders.filter((order) => order.paymentStatus === "paid");
  return {
    published: input.published, publishedUrl: input.publishedUrl,
    visitors: null, visitorsStatus: "not_measured",
    enquiries: input.enquiries.length, orders: input.orders.length,
    paidOrders: paidOrders.length,
    fulfilledOrders: input.orders.filter((order) => order.status === "fulfilled").length,
    paidRevenuePaise: paidOrders.reduce((total, order) => total + order.totalPaise, 0),
    currency: "INR",
    enquiryToPaidOrderRate: input.enquiries.length ? Number(((paidOrders.length / input.enquiries.length) * 100).toFixed(1)) : null,
  };
}
