import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  getFocusedRouteNameFromRoute,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Lock,
  ShoppingCart,
  Package,
  User,
  FileText,
} from 'lucide-react-native';
import { LockedScreen } from '@/components/common/LockedScreen';
import { TAB_PERMISSION } from '@/constants/mobilePermissions';
import { useMobileAccess } from '@/hooks/useMobileAccess';
import { HomeStackNavigator } from '@/navigation/HomeStackNavigator';
import { SettingsStackNavigator } from '@/navigation/SettingsStackNavigator';
import { SalesStackNavigator } from '@/navigation/SalesStackNavigator';
import { ProductsStackNavigator } from '@/navigation/ProductsStackNavigator';
import { ReportsStackNavigator } from '@/navigation/ReportsStackNavigator';
import { colors, shadows, typography } from '@/theme';
import {
  TAB_BAR_BOTTOM_MARGIN,
  TAB_BAR_HEIGHT,
  TAB_BAR_HORIZONTAL_MARGIN,
} from '@/theme/layout';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Tab bar visible only on these root screens — hidden on every nested stack screen. */
const TAB_ROOT_SCREEN: Record<keyof MainTabParamList, string> = {
  Home: 'Dashboard',
  Sales: 'SalesPOS',
  Products: 'ProductsList',
  Reports: 'ReportsList',
  Profile: 'SettingsHome',
};

const tabIcon =
  (Icon: typeof LayoutDashboard, locked: boolean) =>
  ({
    color,
    size,
    focused,
  }: {
    color: string;
    size: number;
    focused: boolean;
  }) =>
    (
      <View
        style={[
          styles.iconWrap,
          focused && !locked && styles.iconWrapActive,
          locked && styles.iconWrapLocked,
        ]}>
        <Icon
          size={focused ? size : size - 1}
          color={locked ? colors.textMuted : focused ? colors.primary : color}
          strokeWidth={focused ? 2.5 : 2}
        />
        {locked ? (
          <View style={styles.lockBadge}>
            <Lock size={10} color={colors.white} strokeWidth={3} />
          </View>
        ) : null}
      </View>
    );

const TAB_STACKS = {
  Home: HomeStackNavigator,
  Sales: SalesStackNavigator,
  Products: ProductsStackNavigator,
  Reports: ReportsStackNavigator,
  Profile: SettingsStackNavigator,
} as const;

export const MainTabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { can, showLocked } = useMobileAccess();
  const isLocked = (tab: keyof MainTabParamList) => {
    const key = TAB_PERMISSION[tab];
    return key !== null && !can(key);
  };
  const initialTab =
    (['Sales', 'Home', 'Products', 'Reports'] as const).find(tab => !isLocked(tab)) ??
    'Profile';
  const tabComponent = (tab: keyof MainTabParamList) =>
    isLocked(tab) ? LockedScreen : TAB_STACKS[tab];
  // tabPress is preventable at runtime (bottom-tabs emits canPreventDefault:
  // true); the installed core/native typings disagree, hence the cast.
  const onTabPress = (tab: keyof MainTabParamList, e: object) => {
    if (isLocked(tab)) {
      (e as { preventDefault: () => void }).preventDefault();
      showLocked();
    }
  };
  const bottomOffset = Math.max(insets.bottom, TAB_BAR_BOTTOM_MARGIN);
  const baseTabBarStyle = {
    position: 'absolute' as const,
    left: TAB_BAR_HORIZONTAL_MARGIN,
    right: TAB_BAR_HORIZONTAL_MARGIN,
    bottom: bottomOffset,
    height: TAB_BAR_HEIGHT,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.tabBar,
    borderTopWidth: 0,
    borderRadius: 28,
    ...shadows.lg,
  };

  const tabOptions =
    <T extends keyof MainTabParamList>(
      tab: T,
      label: string,
      Icon: typeof LayoutDashboard,
    ) =>
    ({ route }: { route: RouteProp<MainTabParamList, T> }) => {
      const rootScreen = TAB_ROOT_SCREEN[tab];
      const focusedRoute = getFocusedRouteNameFromRoute(route) ?? rootScreen;
      const showTabBar = focusedRoute === rootScreen;

      return {
        tabBarLabel: label,
        tabBarIcon: tabIcon(Icon, isLocked(tab)),
        tabBarStyle: showTabBar
          ? baseTabBarStyle
          : [baseTabBarStyle, { display: 'none' as const }],
      };
    };

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: { backgroundColor: colors.backgroundAlt },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          ...typography.tabLabel,
          marginTop: 2,
          marginBottom: Platform.OS === 'ios' ? 0 : 2,
        },
        tabBarStyle: baseTabBarStyle,
        animation: 'shift',
        transitionSpec: {
          animation: 'spring',
          config: {
            stiffness: 400,
            damping: 34,
            mass: 0.85,
            overshootClamping: false,
          },
        },
      }}>
      <Tab.Screen
        name="Home"
        component={tabComponent('Home')}
        listeners={{ tabPress: e => onTabPress('Home', e) }}
        options={tabOptions('Home', 'Home', LayoutDashboard)}
      />
      <Tab.Screen
        name="Sales"
        component={tabComponent('Sales')}
        listeners={{ tabPress: e => onTabPress('Sales', e) }}
        options={tabOptions('Sales', 'Sales', ShoppingCart)}
      />
      <Tab.Screen
        name="Products"
        component={tabComponent('Products')}
        listeners={{ tabPress: e => onTabPress('Products', e) }}
        options={tabOptions('Products', 'Products', Package)}
      />
      <Tab.Screen
        name="Reports"
        component={tabComponent('Reports')}
        listeners={{ tabPress: e => onTabPress('Reports', e) }}
        options={tabOptions('Reports', 'Reports', FileText)}
      />
      <Tab.Screen
        name="Profile"
        component={tabComponent('Profile')}
        listeners={{ tabPress: e => onTabPress('Profile', e) }}
        options={tabOptions('Profile', 'Settings', User)}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.white,
  },
  iconWrapLocked: {
    opacity: 0.55,
  },
  lockBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
