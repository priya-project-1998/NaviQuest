import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";

const PrivacyPolicyScreen = () => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>
        Privacy Policy precedent to use of NaviQuest systems and it’s components.
      </Text>

      <Text style={styles.section}>
        NaviQuest recognises the importance of maintaining your privacy. We value your privacy and appreciate your trust in us. This Policy describes how we treat user information we collect on NaviQuest and other offline sources. This Privacy Policy applies to current and former visitors to our app and register users. By visiting and/or using our app, you agree to this Privacy Policy.
      </Text>

      <Text style={styles.subHeading}>Contact information</Text>
      <Text style={styles.section}>
        We might collect your name, email, mobile number, city, country and ip address, and other information.
      </Text>

      <Text style={styles.subHeading}>Other information</Text>
      <Text style={styles.section}>
        If you use our app, we may collect information about your IP address and the device address you’re using. We might look at what site you came from, duration of time spent on our app, pages accessed or what site you visit when you leave us. We might also collect the type of mobile device you are using, or the version of the operating system your device is running.
      </Text>

      <Text style={styles.subHeading}>Facebook Login</Text>
      <Text style={styles.section}>
        When you choose facebook as login option we validate your facebook account and pick data from that account which includes Gender, First Name, Last Name, Profile picture, Email id.
      </Text>

      <Text style={styles.subHeading}>Google Login</Text>
      <Text style={styles.section}>
        When you choose Google as login option, we validate your google account and pick data from that account which includes Name, Profile picture, Email id
      </Text>

      <Text style={styles.subHeading}>We collect Information about your geographical location</Text>
      <Text style={styles.section}>
        As our app is completed base on race, we track your location in real time during an event and store it on our server for the processing. The Location are stored in database to display results.
      </Text>

      <Text style={styles.subHeading}>We collect information directly from you</Text>
      <Text style={styles.section}>
        We collect information directly from you when you register or create profile.
      </Text>

      <Text style={styles.subHeading}>We collect information from you passively</Text>
      <Text style={styles.section}>
        We use tracking tools like firebase and fabric for collecting information about your usage of our app.
      </Text>

      <Text style={styles.subHeading}>We use information to contact you</Text>
      <Text style={styles.section}>
        We might use the information you provide to contact you for the reminder of event or in case of results.
      </Text>

      <Text style={styles.subHeading}>We use information to improve services</Text>
      <Text style={styles.section}>
        We might use your information to customize your experience with us. This could include displaying offer and events near you.
      </Text>

      <Text style={styles.subHeading}>We use information to send you transactional communications</Text>
      <Text style={styles.section}>
        We might send you emails or SMS about latest offers.
      </Text>

      <Text style={styles.subHeading}>We will share information with third parties who perform services on our behalf</Text>
      <Text style={styles.section}>
        We share information you entered while submitting participation request to the respective Organiser.
      </Text>

      <Text style={styles.subHeading}>We may share your information for reasons not described in this policy</Text>
      <Text style={styles.section}>
        We will tell you before we do this.
      </Text>

      <Text style={styles.subHeading}>Updates to this policy</Text>
      <Text style={styles.section}>
        This Privacy Policy was last updated on Nov 12, 2025. From time to time we may change our privacy practices. We will notify you of any material changes to this policy as required by law. We will also post an updated copy on our website. Please check our site periodically for updates.
      </Text>

      <Text style={styles.subHeading}>Jurisdiction</Text>
      <Text style={styles.section}>
        If you choose to continue the app, your visit and any dispute over privacy is subject to this Policy and the app’s terms of use. In addition to the foregoing, any disputes arising under this Policy shall be governed by the laws of India.
      </Text>

      <Text style={styles.subHeading}>Privacy policy and user data</Text>
      <Text style={styles.section}>
        You agree to NaviQuest data policy, including the collection, use, processing, and sharing of your information as described in our Privacy Policy, as well as the transfer and processing of your information where we have or use facilities, service providers, or partners, regardless of where you use our Services. You acknowledge that the laws, regulations, and standards of the country in which your information is stored or processed may be different from those of your own country. NaviQuest doesn’t not claim the ownership of the information that you submit for NaviQuest account. You shall have the authority and rights to provider such information that you submit for your account.
      </Text>

      <Text style={styles.subHeading}>Ownership</Text>
      <Text style={styles.section}>
        NaviQuest or its licensors retain ownership of all intellectual property rights in and to the Application, including copies, improvements, and modifications thereof. Your right to use the Application is limited to those expressly granted by this Agreement. No other rights with respect of the Application or any related intellectual property rights are granted or implied.
      </Text>

      <Text style={styles.subHeading}>Copyrights</Text>
      <Text style={styles.section}>
        Our services and materials incorporated by Service provider on our Services (“Material”) are protected by copyrights, patents, trade secrets or other proprietary rights (“Copyrights”). Some of the characters, logos, or other images incorporated by Service provider in our services are also protected as reregistered or unregistered trademarks, trade names, and/or service marks owned by the Service providers or its licensors own the title, copyright, and other intellectual property rights in the Material and Service, and by using our Services, you do not acquire any ownership rights in Service or Materials contained therein. Service Provider respects the intellectual property rights of others and asks users of our Services to do the same.
      </Text>

      <Text style={styles.section}>Team NaviQuest</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f2027",
  },
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ff7e5f",
    marginBottom: 15,
    textAlign: "center",
  },
  subHeading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#feb47b",
    marginTop: 15,
    marginBottom: 5,
  },
  section: {
    fontSize: 15,
    color: "#fff",
    lineHeight: 22,
  },
});

export default PrivacyPolicyScreen;
