using Jod.Service.Options;

namespace Jod.Service.Tests;

public class AccessOptionsTests
{
    [Theory]
    [InlineData("friend@gmail.com", true)]
    [InlineData("  FRIEND@Gmail.com ", true)]
    [InlineData("other@gmail.com", false)]
    [InlineData("friend@gmail.com.evil.example", false)]
    public void IsAllowed_ComparesIgnoringCaseAndSurroundingSpaces(string email, bool expected)
    {
        // Arrange
        var access = new AccessOptions { AllowedEmails = [" Friend@gmail.com "] };

        // Act
        var allowed = access.IsAllowed(email);

        // Assert
        Assert.Equal(expected, allowed);
    }

    [Fact]
    public void IsAllowed_WithAnEmptyList_LetsNobodyIn()
    {
        // Arrange
        var access = new AccessOptions();

        // Act
        var allowed = access.IsAllowed("friend@gmail.com");

        // Assert
        Assert.False(allowed);
    }
}
