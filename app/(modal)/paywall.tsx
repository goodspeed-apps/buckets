/**
 * GAS Template, Paywall Screen
 *
 * Multi-model paywall with config-driven tabs:
 * - Plans: RevenueCat subscription offerings (existing)
 * - Products: One-time purchases (lifetime unlock, feature packs)
 * - Credits: Consumable credit packs with balance display
 *
 * Shows tab bar only when multiple payment models are active.
 * Falls back to single subscription view for backwards compatibility.
 *
 * All colors come from useThemeColors(), never hardcoded.
 * Uses SafeAreaView from 'react-native-safe-area-context' (CRITICAL).
 */

import { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useSubscription } from '@/hooks/useSubscription';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useThemeColors } from '@/context/ThemeContext';
import { trackScreenLoad } from '@/lib/performance';
import { addBreadcrumb } from '@/lib/sentry';
import { purchaseProduct } from '@/lib/revenuecat';
import { callEdge } from '@/services/api';
import { gasConfig } from '../../gas.config';

const IAP_ENABLED = gasConfig.features.inAppPurchases.enabled;
const APP_NAME = gasConfig.app.name;
const TIERS = gasConfig.features.inAppPurchases.tiers;
const ONE_TIME_PRODUCTS = (gasConfig.features.inAppPurchases.oneTimePurchases ?? []) as Array<{
  id: string;
  productId: string;
  name: string;
  description: string;
  type: string;
  price?: string;
}>;
const CREDITS_CONFIG = gasConfig.features.inAppPurchases.credits as {
  enabled: boolean;
  currencyName: string;
  packs: Array<{
    id: string;
    productId: string;
    credits: number;
    bonusCredits?: number;
    name?: string;
    price?: string;
  }>;
} | null | undefined;

// Get feature list from the highest tier (last in the array) for the hero section.
const PRO_TIER = TIERS.length > 1 ? TIERS[TIERS.length - 1] : null;
const FEATURES = PRO_TIER?.features ?? ['Full access to all features'];

// Check if any tier has a trial period.
const TRIAL_TIER = TIERS.find(t => (t.trialDays ?? 0) > 0);
const TRIAL_DAYS = TRIAL_TIER?.trialDays ?? 0;

// Build available tabs from config
type PaywallTab = 'plans' | 'products' | 'credits';
const AVAILABLE_TABS: { id: PaywallTab; label: string }[] = [];
if (TIERS.length > 1) AVAILABLE_TABS.push({ id: 'plans', label: 'Plans' });
if (ONE_TIME_PRODUCTS.length > 0) AVAILABLE_TABS.push({ id: 'products', label: 'Products' });
if (CREDITS_CONFIG?.enabled) AVAILABLE_TABS.push({ id: 'credits', label: CREDITS_CONFIG.currencyName.charAt(0).toUpperCase() + CREDITS_CONFIG.currencyName.slice(1) });

const TYPED_TIERS = TIERS as Array<{
  id: string;
  productId: string;
  name: string;
  price: string;
  description?: string;
  popular?: boolean;
  features?: string[];
  trialDays?: number;
}>;

export default function PaywallScreen() {
  const { tab: initialTab } = useLocalSearchParams<{ tab?: PaywallTab }>();
  const { track } = useAnalytics();
  const { colors } = useThemeColors();
  const { offerings, isLoading, purchase, purchaseOneTime, restore, ownedProducts } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PaywallTab>(
    initialTab && AVAILABLE_TABS.some(t => t.id === initialTab)
      ? initialTab
      : AVAILABLE_TABS[0]?.id ?? 'plans'
  );

  const screenStart = Date.now();
  useEffect(() => {
    track('paywall_displayed', { tab: activeTab });
    trackScreenLoad('paywall', screenStart);
    addBreadcrumb('monetization', 'Paywall displayed');
  }, []);

  const packages = offerings?.current?.availablePackages ?? [];

  useEffect(() => {
    if (packages.length > 0 && !selectedPackageId) {
      setSelectedPackageId(packages[0]?.identifier ?? null);
    }
  }, [packages, selectedPackageId]);

  const showTabs = AVAILABLE_TABS.length > 1;

  // --- Dynamic styles based on theme colors ---
  const dynamicStyles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
    closeBtn: { padding: 4 },
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginVertical: 12,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 4,
    },
    tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    tabItemActive: { backgroundColor: colors.background },
    tabText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
    tabTextActive: { color: colors.text, fontWeight: '600' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },
    heroSection: { alignItems: 'center', marginBottom: 24 },
    heroTitle: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center' },
    heroSub: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
    featureList: { marginTop: 16, width: '100%' },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    featureText: { fontSize: 15, color: colors.text, marginLeft: 8 },
    planCard: {
      borderWidth: 2,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      backgroundColor: colors.surface,
    },
    planCardSelected: { borderColor: colors.primary },
    planCardUnselected: { borderColor: colors.border },
    planCardPopularBadge: {
      position: 'absolute', top: -10, right: 16,
      backgroundColor: colors.primary,
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2,
    },
    planCardPopularText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    planName: { fontSize: 17, fontWeight: '700', color: colors.text },
    planPrice: { fontSize: 15, color: colors.textSecondary, marginTop: 2 },
    planDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
    ctaButton: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    restoreBtn: { alignItems: 'center', marginBottom: 24 },
    restoreText: { color: colors.textSecondary, fontSize: 14 },
    trialBadge: {
      backgroundColor: colors.primaryMuted ?? colors.surface,
      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4,
      alignSelf: 'center', marginBottom: 8,
    },
    trialText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
    productCard: {
      backgroundColor: colors.surface,
      borderRadius: 14, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    productOwned: { borderColor: colors.success ?? colors.border },
    productName: { fontSize: 17, fontWeight: '700', color: colors.text },
    productDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    productPrice: { fontSize: 15, fontWeight: '600', color: colors.primary, marginTop: 8 },
    productOwnedBadge: {
      alignSelf: 'flex-start', marginTop: 8,
      backgroundColor: colors.success ?? colors.surface,
      borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
    },
    productOwnedText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    creditCard: {
      backgroundColor: colors.surface,
      borderRadius: 14, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    creditAmount: { fontSize: 22, fontWeight: '700', color: colors.text },
    creditBonus: { fontSize: 13, color: colors.success ?? colors.textSecondary, marginTop: 2 },
    creditPrice: { fontSize: 17, fontWeight: '700', color: colors.primary },
  }), [colors]);

  // --- Credits tab ---
  const renderCreditsTab = () => {
    const packs = CREDITS_CONFIG?.packs ?? [];
    return (
      <ScrollView style={dynamicStyles.scroll} contentContainerStyle={dynamicStyles.scrollContent}>
        {packs.map((pack) => (
          <TouchableOpacity
            key={pack.id}
            style={dynamicStyles.creditCard}
            onPress={() => handleCreditPurchase(pack.id, pack.productId)}
            disabled={purchasing}
          >
            <View>
              <Text style={dynamicStyles.creditAmount}>{pack.credits} {CREDITS_CONFIG?.currencyName}</Text>
              {(pack.bonusCredits ?? 0) > 0 && (
                <Text style={dynamicStyles.creditBonus}>+{pack.bonusCredits} bonus</Text>
              )}
            </View>
            <Text style={dynamicStyles.creditPrice}>{pack.price ?? ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // --- Products tab ---
  const renderProductsTab = () => (
    <ScrollView style={dynamicStyles.scroll} contentContainerStyle={dynamicStyles.scrollContent}>
      {ONE_TIME_PRODUCTS.map((product) => {
        const owned = (ownedProducts ?? []).includes(product.id);
        return (
          <View key={product.id} style={[dynamicStyles.productCard, owned && dynamicStyles.productOwned]}>
            <Text style={dynamicStyles.productName}>{product.name}</Text>
            <Text style={dynamicStyles.productDesc}>{product.description}</Text>
            {!owned && (
              <TouchableOpacity onPress={() => handleProductPurchase(product.id, product.productId)} disabled={purchasing}>
                <Text style={dynamicStyles.productPrice}>{product.name} — {product.name}</Text>
              </TouchableOpacity>
            )}
            {owned && (
              <View style={dynamicStyles.productOwnedBadge}>
                <Text style={dynamicStyles.productOwnedText}>Owned</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );

  // --- Plans tab ---
  const renderPlansTab = () => (
    <ScrollView style={dynamicStyles.scroll} contentContainerStyle={dynamicStyles.scrollContent}>
      <View style={dynamicStyles.heroSection}>
        <Text style={dynamicStyles.heroTitle}>Upgrade {APP_NAME}</Text>
        <Text style={dynamicStyles.heroSub}>Unlock everything. Cancel anytime.</Text>
        {TRIAL_DAYS > 0 && (
          <View style={dynamicStyles.trialBadge}>
            <Text style={dynamicStyles.trialText}>{TRIAL_DAYS}-day free trial</Text>
          </View>
        )}
        <View style={dynamicStyles.featureList}>
          {FEATURES.map((f, i) => (
            <View key={i} style={dynamicStyles.featureRow}>
              <Text style={{ color: colors.primary }}>✓</Text>
              <Text style={dynamicStyles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      </View>
      {TYPED_TIERS.map((tier) => (
        <TouchableOpacity
          key={tier.id}
          style={[
            dynamicStyles.planCard,
            selectedPackageId === tier.id ? dynamicStyles.planCardSelected : dynamicStyles.planCardUnselected,
          ]}
          onPress={() => setSelectedPackageId(tier.id)}
        >
          {tier.popular && (
            <View style={dynamicStyles.planCardPopularBadge}>
              <Text style={dynamicStyles.planCardPopularText}>Popular</Text>
            </View>
          )}
          <Text style={dynamicStyles.planName}>{tier.name}</Text>
          <Text style={dynamicStyles.planPrice}>{tier.price}</Text>
          {tier.popular && <Text style={dynamicStyles.planDesc}>Most popular choice</Text>}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const handleSubscribe = async () => {
    if (!selectedPackageId) return;
    const pkg = packages.find(p => p.identifier === selectedPackageId);
    if (!pkg) {
      // Try purchasing by productId from tiers
      const tier = TYPED_TIERS.find(t => t.id === selectedPackageId);
      if (!tier) return;
      setPurchasing(true);
      try {
        await purchaseProduct(tier.productId);
        track('subscription_purchased', { tier: tier.id });
        router.back();
      } catch (e) {
        Alert.alert('Purchase Failed', 'Please try again.');
      } finally {
        setPurchasing(false);
      }
      return;
    }
    setPurchasing(true);
    try {
      await purchase(pkg);
      track('subscription_purchased', { package: selectedPackageId });
      router.back();
    } catch (e) {
      Alert.alert('Purchase Failed', 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleProductPurchase = async (productId: string, revenueCatId: string) => {
    setPurchasing(true);
    try {
      if (purchaseOneTime) {
        await purchaseOneTime(revenueCatId);
      } else {
        await purchaseProduct(revenueCatId);
      }
      track('product_purchased', { product: productId });
      router.back();
    } catch (e) {
      Alert.alert('Purchase Failed', 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleCreditPurchase = async (packId: string, revenueCatId: string) => {
    setPurchasing(true);
    try {
      await purchaseProduct(revenueCatId);
      await callEdge('grant-credits', { packId });
      track('credits_purchased', { pack: packId });
      router.back();
    } catch (e) {
      Alert.alert('Purchase Failed', 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      await restore();
      Alert.alert('Restored', 'Your purchases have been restored.');
    } catch (e) {
      Alert.alert('Restore Failed', 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (!IAP_ENABLED) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <Text style={{ textAlign: 'center', marginTop: 40, color: colors.textSecondary }}>
          In-app purchases are not enabled.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Text style={dynamicStyles.headerTitle}>{APP_NAME} Premium</Text>
        <TouchableOpacity style={dynamicStyles.closeBtn} onPress={() => router.back()}>
          <X size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {showTabs && (
        <View style={dynamicStyles.tabBar}>
          {AVAILABLE_TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[dynamicStyles.tabItem, activeTab === tab.id && dynamicStyles.tabItemActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[dynamicStyles.tabText, activeTab === tab.id && dynamicStyles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <>
          {activeTab === 'plans' && renderPlansTab()}
          {activeTab === 'products' && renderProductsTab()}
          {activeTab === 'credits' && renderCreditsTab()}
        </>
      )}

      {activeTab === 'plans' && !isLoading && (
        <>
          <TouchableOpacity
            style={[dynamicStyles.ctaButton, purchasing && { opacity: 0.7 }]}
            onPress={handleSubscribe}
            disabled={purchasing || !selectedPackageId}
          >
            {purchasing
              ? <ActivityIndicator color="#fff" />
              : <Text style={dynamicStyles.ctaText}>
                  {TRIAL_DAYS > 0 ? `Start ${TRIAL_DAYS}-Day Free Trial` : 'Subscribe Now'}
                </Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.restoreBtn} onPress={handleRestore} disabled={purchasing}>
            <Text style={dynamicStyles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}
