package com.tahafirat.zihinharitam;

import android.app.Activity;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Native Google Play Billing Library v7.1.1 plugin for ZihinHaritam.
 * Exposes the exact same Capacitor interface ("StoreKitBilling") as StoreKitPlugin.swift on iOS:
 * - getProducts (SUBS + INAPP)
 * - purchaseLifetime (Subscription or One-Time Lifetime purchase + automatic acknowledgment)
 * - restorePurchases (queries both active SUBS & owned INAPP purchases)
 * - checkEntitlements (launch-time entitlement check)
 */
@CapacitorPlugin(name = "StoreKitBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private static final Set<String> SUBSCRIPTION_IDS = new HashSet<>(Arrays.asList(
        "com.tahafirat.zihinharitam.pro_monthly",
        "com.tahafirat.zihinharitam.pro_yearly"
    ));

    private static final Set<String> INAPP_IDS = new HashSet<>(Arrays.asList(
        "com.tahafirat.zihinharitam.lifetime_pro"
    ));

    private BillingClient billingClient;
    private final Map<String, ProductDetails> productCache = new HashMap<>();
    private PluginCall pendingPurchaseCall = null;
    private String pendingProductId = null;

    @Override
    public void load() {
        super.load();
        ensureBillingClient();
    }

    private void ensureBillingClient() {
        if (billingClient == null) {
            billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(
                    PendingPurchasesParams.newBuilder()
                        .enableOneTimeProducts()
                        .build()
                )
                .build();
        }
    }

    private void withConnectedBilling(Runnable onReady, Runnable onFailed) {
        ensureBillingClient();
        if (billingClient.isReady()) {
            onReady.run();
            return;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    onReady.run();
                } else {
                    onFailed.run();
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Next user action will reconnect automatically
            }
        });
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        JSArray idsArr = call.getArray("productIds");
        List<String> requestedIds = new ArrayList<>();
        if (idsArr != null) {
            try {
                for (int i = 0; i < idsArr.length(); i++) {
                    String id = idsArr.getString(i);
                    if (id != null && !id.isEmpty()) requestedIds.add(id);
                }
            } catch (Exception ignored) {
            }
        }
        if (requestedIds.isEmpty()) {
            requestedIds.addAll(SUBSCRIPTION_IDS);
            requestedIds.addAll(INAPP_IDS);
        }

        withConnectedBilling(() -> queryAllProducts(requestedIds, call), () -> {
            JSObject ret = new JSObject();
            ret.put("products", new JSArray());
            call.resolve(ret);
        });
    }

    private void queryAllProducts(List<String> requestedIds, PluginCall call) {
        List<QueryProductDetailsParams.Product> subProducts = new ArrayList<>();
        List<QueryProductDetailsParams.Product> inappProducts = new ArrayList<>();

        for (String id : requestedIds) {
            if (SUBSCRIPTION_IDS.contains(id)) {
                subProducts.add(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                );
            } else {
                inappProducts.add(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                );
            }
        }

        JSArray results = new JSArray();
        int totalBatches = (subProducts.isEmpty() ? 0 : 1) + (inappProducts.isEmpty() ? 0 : 1);
        if (totalBatches == 0) {
            JSObject ret = new JSObject();
            ret.put("products", results);
            call.resolve(ret);
            return;
        }

        AtomicInteger remaining = new AtomicInteger(totalBatches);

        Runnable finishOne = () -> {
            if (remaining.decrementAndGet() == 0) {
                JSObject ret = new JSObject();
                ret.put("products", results);
                call.resolve(ret);
            }
        };

        if (!subProducts.isEmpty()) {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(subProducts)
                .build();
            billingClient.queryProductDetailsAsync(params, (billingResult, queryResult) -> {
                List<ProductDetails> list = queryResult != null ? queryResult.getProductDetailsList() : null;
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null) {
                    synchronized (results) {
                        for (ProductDetails pd : list) {
                            productCache.put(pd.getProductId(), pd);
                            results.put(toProductJson(pd));
                        }
                    }
                }
                finishOne.run();
            });
        }

        if (!inappProducts.isEmpty()) {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(inappProducts)
                .build();
            billingClient.queryProductDetailsAsync(params, (billingResult, queryResult) -> {
                List<ProductDetails> list = queryResult != null ? queryResult.getProductDetailsList() : null;
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null) {
                    synchronized (results) {
                        for (ProductDetails pd : list) {
                            productCache.put(pd.getProductId(), pd);
                            results.put(toProductJson(pd));
                        }
                    }
                }
                finishOne.run();
            });
        }
    }

    /**
     * Parses ISO-8601 Google Play billingPeriod (e.g. "P7D", "P1W", "P14D") into free trial days.
     */
    private int parseIsoTrialDays(@Nullable String period) {
        if (period == null || period.isEmpty()) return 7;
        try {
            String p = period.trim().toUpperCase();
            if (p.startsWith("P") && p.endsWith("D")) {
                return Math.max(1, Integer.parseInt(p.substring(1, p.length() - 1)));
            }
            if (p.startsWith("P") && p.endsWith("W")) {
                return Math.max(1, Integer.parseInt(p.substring(1, p.length() - 1)) * 7);
            }
            if (p.startsWith("P") && p.endsWith("M")) {
                return Math.max(1, Integer.parseInt(p.substring(1, p.length() - 1)) * 30);
            }
        } catch (Exception ignored) {
        }
        return 7;
    }

    /**
     * Deterministically selects the best eligible offer for a subscription ProductDetails:
     * 1. If Google Play returns an eligible Free Trial offer (first phase == 0 micros AND final phase > 0),
     *    select THAT exact offer so both `getProducts` and `launchBillingFlow` use the identical `offerToken`.
     * 2. Otherwise deterministically select the standard base-plan offer (`offerId == null`).
     * Never mixes different plans or displays 0 TL as the recurring price!
     */
    @Nullable
    private ProductDetails.SubscriptionOfferDetails selectPrimaryOffer(@NonNull ProductDetails pd) {
        List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;

        // 1. Check for eligible Free Trial offer on this exact productId
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
            if (offer.getOfferId() != null && phases.size() >= 2) {
                ProductDetails.PricingPhase firstPhase = phases.get(0);
                ProductDetails.PricingPhase lastPhase = phases.get(phases.size() - 1);
                if (firstPhase.getPriceAmountMicros() == 0 && lastPhase.getPriceAmountMicros() > 0) {
                    return offer;
                }
            }
        }

        // 2. Fall back cleanly to standard base-plan offer (offerId == null)
        for (ProductDetails.SubscriptionOfferDetails offer : offers) {
            if (offer.getOfferId() == null) {
                return offer;
            }
        }
        return offers.get(0);
    }

    private JSObject toProductJson(ProductDetails pd) {
        JSObject obj = new JSObject();
        obj.put("id", pd.getProductId());
        obj.put("title", pd.getName());
        obj.put("description", pd.getDescription());

        String displayPrice = "";
        double numericPrice = 0.0;

        if (BillingClient.ProductType.SUBS.equals(pd.getProductType())) {
            ProductDetails.SubscriptionOfferDetails primaryOffer = selectPrimaryOffer(pd);
            if (primaryOffer != null) {
                List<ProductDetails.PricingPhase> phases = primaryOffer.getPricingPhases().getPricingPhaseList();
                if (!phases.isEmpty()) {
                    // ALWAYS read displayPrice from the final recurring phase (never ₺0,00!)
                    ProductDetails.PricingPhase recurringPhase = phases.get(phases.size() - 1);
                    displayPrice = recurringPhase.getFormattedPrice();
                    numericPrice = recurringPhase.getPriceAmountMicros() / 1_000_000.0;

                    if (phases.size() >= 2 && phases.get(0).getPriceAmountMicros() == 0) {
                        JSObject intro = new JSObject();
                        intro.put("eligible", true);
                        intro.put("freeTrialDays", parseIsoTrialDays(phases.get(0).getBillingPeriod()));
                        intro.put("paymentMode", "free_trial");
                        obj.put("introOffer", intro);
                    }
                }
            }
        } else {
            ProductDetails.OneTimePurchaseOfferDetails otp = pd.getOneTimePurchaseOfferDetails();
            if (otp != null) {
                displayPrice = otp.getFormattedPrice();
                numericPrice = otp.getPriceAmountMicros() / 1_000_000.0;
            }
        }

        obj.put("displayPrice", displayPrice);
        obj.put("price", numericPrice);
        return obj;
    }

    @PluginMethod
    public void purchaseLifetime(PluginCall call) {
        // Strict SKU Lock: NEVER default to another plan (prevents launching Yearly when Monthly was tapped!)
        String productId = call.getString("productId");
        if (productId == null || productId.trim().isEmpty()
                || (!SUBSCRIPTION_IDS.contains(productId) && !INAPP_IDS.contains(productId))) {
            JSObject ret = new JSObject();
            ret.put("purchased", false);
            ret.put("errorMessage", "Geçersiz plan seçimi. Lütfen satın almak istediğiniz paketi tekrar seçin.");
            call.resolve(ret);
            return;
        }
        if (pendingPurchaseCall != null) {
            JSObject ret = new JSObject();
            ret.put("purchased", false);
            ret.put("errorMessage", "Devam eden bir Google Play satın alma işlemi var. Lütfen tamamlanmasını bekleyin.");
            call.resolve(ret);
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            JSObject ret = new JSObject();
            ret.put("purchased", false);
            ret.put("errorMessage", "Google Play ödeme ekranı başlatılamadı.");
            call.resolve(ret);
            return;
        }

        withConnectedBilling(() -> {
            ProductDetails cached = productCache.get(productId);
            if (cached != null && productId.equals(cached.getProductId())) {
                launchFlowForProduct(activity, cached, productId, call);
                return;
            }

            String type = SUBSCRIPTION_IDS.contains(productId)
                ? BillingClient.ProductType.SUBS
                : BillingClient.ProductType.INAPP;

            List<QueryProductDetailsParams.Product> single = new ArrayList<>();
            single.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(type)
                    .build()
            );

            billingClient.queryProductDetailsAsync(
                QueryProductDetailsParams.newBuilder().setProductList(single).build(),
                (res, queryResult) -> {
                    List<ProductDetails> list = queryResult != null ? queryResult.getProductDetailsList() : null;
                    ProductDetails matchedPd = null;
                    if (res.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null) {
                        for (ProductDetails candidate : list) {
                            if (productId.equals(candidate.getProductId())) {
                                matchedPd = candidate;
                                break;
                            }
                        }
                    }
                    if (matchedPd != null) {
                        productCache.put(matchedPd.getProductId(), matchedPd);
                        launchFlowForProduct(activity, matchedPd, productId, call);
                    } else {
                        JSObject ret = new JSObject();
                        ret.put("purchased", false);
                        ret.put("errorMessage", "Seçilen plan Google Play mağazasında şu anda aktif değil. Lütfen daha sonra tekrar deneyin.");
                        call.resolve(ret);
                    }
                }
            );
        }, () -> {
            JSObject ret = new JSObject();
            ret.put("purchased", false);
            ret.put("errorMessage", "Google Play faturalandırma servisine bağlanılamadı.");
            call.resolve(ret);
        });
    }

    private void launchFlowForProduct(Activity activity, ProductDetails pd, String expectedProductId, PluginCall call) {
        if (!expectedProductId.equals(pd.getProductId())) {
            JSObject ret = new JSObject();
            ret.put("purchased", false);
            ret.put("errorMessage", "Ürün kimliği doğrulanamadı. Lütfen tekrar deneyin.");
            call.resolve(ret);
            return;
        }
        BillingFlowParams.ProductDetailsParams.Builder prodParamsBuilder =
            BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd);

        if (BillingClient.ProductType.SUBS.equals(pd.getProductType())) {
            ProductDetails.SubscriptionOfferDetails primaryOffer = selectPrimaryOffer(pd);
            if (primaryOffer == null || primaryOffer.getOfferToken() == null || primaryOffer.getOfferToken().isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("purchased", false);
                ret.put("errorMessage", "Abonelik teklifi bulunamadı.");
                call.resolve(ret);
                return;
            }
            prodParamsBuilder.setOfferToken(primaryOffer.getOfferToken());
        }

        List<BillingFlowParams.ProductDetailsParams> paramsList = new ArrayList<>();
        paramsList.add(prodParamsBuilder.build());

        BillingFlowParams flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(paramsList)
            .build();

        pendingPurchaseCall = call;
        pendingProductId = pd.getProductId();

        activity.runOnUiThread(() -> {
            BillingResult launchRes = billingClient.launchBillingFlow(activity, flowParams);
            if (launchRes.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                PluginCall active = pendingPurchaseCall;
                pendingPurchaseCall = null;
                pendingProductId = null;
                if (active != null) {
                    JSObject ret = new JSObject();
                    ret.put("purchased", false);
                    ret.put("errorMessage", launchRes.getDebugMessage());
                    active.resolve(ret);
                }
            }
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, @Nullable List<Purchase> purchases) {
        PluginCall activeCall = pendingPurchaseCall;
        String activeProd = pendingProductId;
        pendingPurchaseCall = null;
        pendingProductId = null;

        int code = billingResult.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {
            Purchase matched = purchases.get(0);
            if (matched.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                final String resolvedPid = activeProd != null
                    ? activeProd
                    : (matched.getProducts().isEmpty() ? "" : matched.getProducts().get(0));
                final String resolvedTxId = matched.getOrderId() != null
                    ? matched.getOrderId()
                    : matched.getPurchaseToken();
                // Acknowledge BEFORE resolving JS so Google Play never auto-refunds after 3 days!
                acknowledgeIfNeeded(matched, () -> {
                    if (activeCall != null) {
                        JSObject ret = new JSObject();
                        ret.put("purchased", true);
                        ret.put("productId", resolvedPid);
                        ret.put("transactionId", resolvedTxId);
                        activeCall.resolve(ret);
                    }
                });
            } else if (matched.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                if (activeCall != null) {
                    JSObject ret = new JSObject();
                    ret.put("purchased", false);
                    ret.put("pending", true);
                    activeCall.resolve(ret);
                }
            }
            return;
        }

        if (activeCall != null) {
            JSObject ret = new JSObject();
            ret.put("purchased", false);
            if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
                ret.put("cancelled", true);
            } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                ret.put("purchased", true);
                ret.put("productId", activeProd);
                ret.put("transactionId", "already_owned");
            } else {
                ret.put("errorMessage", billingResult.getDebugMessage());
            }
            activeCall.resolve(ret);
        }
    }

    private void acknowledgeIfNeeded(Purchase purchase, @Nullable Runnable onComplete) {
        if (!purchase.isAcknowledged()) {
            AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.getPurchaseToken())
                .build();
            billingClient.acknowledgePurchase(ackParams, result -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    // Single silent retry on transient network glitch
                    billingClient.acknowledgePurchase(ackParams, retryRes -> {
                        if (onComplete != null) onComplete.run();
                    });
                } else if (onComplete != null) {
                    onComplete.run();
                }
            });
        } else if (onComplete != null) {
            onComplete.run();
        }
    }

    @PluginMethod
    public void requestAppReview(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("requested", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        queryActiveEntitlements(call, true);
    }

    @PluginMethod
    public void checkEntitlements(PluginCall call) {
        queryActiveEntitlements(call, false);
    }

    private void queryActiveEntitlements(PluginCall call, boolean includeRestoredFlag) {
        withConnectedBilling(() -> {
            AtomicBoolean unlocked = new AtomicBoolean(false);
            AtomicInteger remaining = new AtomicInteger(2);

            Runnable doneOne = () -> {
                if (remaining.decrementAndGet() == 0) {
                    JSObject ret = new JSObject();
                    ret.put("isLifetimePro", unlocked.get());
                    if (includeRestoredFlag) {
                        ret.put("restored", unlocked.get());
                    }
                    call.resolve(ret);
                }
            };

            billingClient.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (res, list) -> {
                    if (res.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null) {
                        for (Purchase p : list) {
                            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                acknowledgeIfNeeded(p, null);
                                unlocked.set(true);
                            }
                        }
                    }
                    doneOne.run();
                }
            );

            billingClient.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (res, list) -> {
                    if (res.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null) {
                        for (Purchase p : list) {
                            if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                                acknowledgeIfNeeded(p, null);
                                unlocked.set(true);
                            }
                        }
                    }
                    doneOne.run();
                }
            );
        }, () -> {
            JSObject ret = new JSObject();
            ret.put("isLifetimePro", false);
            if (includeRestoredFlag) {
                ret.put("restored", false);
            }
            call.resolve(ret);
        });
    }
}
