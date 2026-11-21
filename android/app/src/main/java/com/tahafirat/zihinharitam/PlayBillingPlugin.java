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

    private JSObject toProductJson(ProductDetails pd) {
        JSObject obj = new JSObject();
        obj.put("id", pd.getProductId());
        obj.put("title", pd.getName());
        obj.put("description", pd.getDescription());

        String displayPrice = "";
        double numericPrice = 0.0;

        if (BillingClient.ProductType.SUBS.equals(pd.getProductType())) {
            List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
            if (offers != null && !offers.isEmpty()) {
                List<ProductDetails.PricingPhase> phases = offers.get(0).getPricingPhases().getPricingPhaseList();
                if (!phases.isEmpty()) {
                    ProductDetails.PricingPhase phase = phases.get(phases.size() - 1);
                    displayPrice = phase.getFormattedPrice();
                    numericPrice = phase.getPriceAmountMicros() / 1_000_000.0;
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
        String productId = call.getString("productId", "com.tahafirat.zihinharitam.pro_yearly");
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
            if (cached != null) {
                launchFlowForProduct(activity, cached, call);
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
                    if (res.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null && !list.isEmpty()) {
                        ProductDetails pd = list.get(0);
                        productCache.put(pd.getProductId(), pd);
                        launchFlowForProduct(activity, pd, call);
                    } else {
                        JSObject ret = new JSObject();
                        ret.put("purchased", false);
                        ret.put("errorMessage", "Ürün Google Play mağazasında henüz aktif değil. Lütfen daha sonra tekrar deneyin.");
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

    private void launchFlowForProduct(Activity activity, ProductDetails pd, PluginCall call) {
        BillingFlowParams.ProductDetailsParams.Builder prodParamsBuilder =
            BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd);

        if (BillingClient.ProductType.SUBS.equals(pd.getProductType())) {
            List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
            if (offers == null || offers.isEmpty()) {
                JSObject ret = new JSObject();
                ret.put("purchased", false);
                ret.put("errorMessage", "Abonelik teklifi bulunamadı.");
                call.resolve(ret);
                return;
            }
            prodParamsBuilder.setOfferToken(offers.get(0).getOfferToken());
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
                acknowledgeIfNeeded(matched);
                if (activeCall != null) {
                    JSObject ret = new JSObject();
                    ret.put("purchased", true);
                    ret.put("productId", activeProd != null ? activeProd : (matched.getProducts().isEmpty() ? "" : matched.getProducts().get(0)));
                    ret.put("transactionId", matched.getOrderId() != null ? matched.getOrderId() : matched.getPurchaseToken());
                    activeCall.resolve(ret);
                }
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

    private void acknowledgeIfNeeded(Purchase purchase) {
        if (!purchase.isAcknowledged()) {
            AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.getPurchaseToken())
                .build();
            billingClient.acknowledgePurchase(ackParams, result -> {
                // Acknowledged silently
            });
        }
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
                                acknowledgeIfNeeded(p);
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
                                acknowledgeIfNeeded(p);
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
